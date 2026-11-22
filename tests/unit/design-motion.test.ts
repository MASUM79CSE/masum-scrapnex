import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase F gates from `docs/DESIGN_APPLE_PLAN.md`.
 *
 * Motion is the easiest part of a design system to let rot: one 600 ms transition
 * added in a hurry turns a fast tool into a sluggish one, and animating `width`
 * or `height` costs a layout on every frame. Both are checked here, statically,
 * because they are cheap to check and expensive to notice.
 */

const budget = 320; // ms — the plan's ceiling for any single transition or animation

function styleFiles(): string[] {
  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  return walk("src").filter((file) => file.endsWith(".css"));
}

/** Lines added by the Apple design layer; legacy rules are not re-audited here. */
function designLayer(file: string): string {
  const text = readFileSync(file, "utf8");
  const start = text.indexOf("Phase A: foundations");
  return start === -1 ? "" : text.slice(start);
}

describe("motion budget (Phase F)", () => {
  it("never declares a transition or animation longer than 320 ms", () => {
    const offenders: string[] = [];
    for (const file of styleFiles()) {
      for (const match of readFileSync(file, "utf8").matchAll(
        /(?:animation|transition)(?:-duration)?:\s*([^;]+);/g,
      )) {
        const value = match[1] ?? "";
        // An infinite loop (the spinner) has no end to budget; it is the only one.
        if (/infinite/.test(value)) continue;
        for (const duration of value.matchAll(/([\d.]+)(ms|s)\b/g)) {
          const ms =
            duration[2] === "s"
              ? Number(duration[1]) * 1000
              : Number(duration[1]);
          if (ms > budget)
            offenders.push(`${file}: ${match[0].trim().slice(0, 60)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("only animates transform and opacity in keyframes", () => {
    const offenders: string[] = [];
    for (const file of styleFiles()) {
      const text = readFileSync(file, "utf8");
      for (const block of text.matchAll(
        /@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g,
      ))
        for (const declaration of (block[2] ?? "").matchAll(/([a-z-]+)\s*:/g)) {
          const property = declaration[1] ?? "";
          if (!["transform", "opacity"].includes(property))
            offenders.push(`${file}: ${block[1]} animates ${property}`);
        }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps every spacing literal in the design layer on the 2 px grid", () => {
    const offenders: string[] = [];
    for (const file of styleFiles()) {
      for (const [index, line] of designLayer(file).split("\n").entries())
        if (/(padding|margin|gap)[^:]*:\s*[^;]+;/.test(line))
          for (const literal of line.matchAll(/(-?[\d.]+)px/g)) {
            const value = Number(literal[1]);
            if (value !== 0 && value % 2 !== 0)
              offenders.push(`${file}:${index + 1}: ${line.trim()}`);
          }
    }
    expect(offenders).toEqual([]);
  });

  it("uses one stroke weight for every icon", () => {
    const css = readFileSync("src/styles/base.css", "utf8");
    expect(css).toMatch(/svg\s*\{\s*stroke-width:\s*var\(--icon-stroke\)/);
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    expect(tokens).toMatch(/--icon-stroke:\s*2;/);
  });
});
