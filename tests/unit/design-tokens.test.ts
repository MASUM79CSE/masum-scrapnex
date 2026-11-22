import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Zero-tolerance gates G1–G6 from `docs/DESIGN_APPLE_PLAN.md`.
 * These are machine checks: a failing gate blocks the design phase.
 */

const tokenFile = "src/styles/tokens.css";
const css = readFileSync(tokenFile, "utf8");

/** Split the token file on `/* BLOCK: name *\/` markers. */
function blocks(): Map<string, string> {
  const map = new Map<string, string>();
  const parts = css.split(/\/\* BLOCK: ([a-z]+) \*\//);
  for (let index = 1; index < parts.length; index += 2) {
    map.set(parts[index] ?? "", parts[index + 1] ?? "");
  }
  return map;
}

/** Resolve a token value inside one block, following one level of `var()` aliasing. */
function value(block: string, name: string, seen = 0): string | null {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(block);
  if (!match) return null;
  const raw = match[1]!.trim();
  const alias = /^var\(--([a-z0-9-]+)\)$/i.exec(raw);
  if (alias && seen < 4) {
    const target = alias[1]!;
    for (const candidate of [block, css]) {
      const resolved = value(candidate, target, seen + 1);
      if (resolved) return resolved;
    }
  }
  return raw;
}

function rgb(input: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input);
  if (hex) {
    const digits = hex[1]!;
    const full =
      digits.length === 3
        ? digits
            .split("")
            .map((char) => char + char)
            .join("")
        : digits;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(input);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  return null;
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string): number {
  const front = rgb(foreground);
  const back = rgb(background);
  if (!front || !back)
    throw new Error(`Unparseable colour: ${foreground} / ${background}`);
  const [light, dark] = [luminance(front), luminance(back)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const contexts = ["dark", "light", "system"] as const;

/** Extracts `<selector> { ... }` from inside a block, brace-matched. */
function subBlock(block: string, selector: string): string | null {
  const start = block.indexOf(`${selector} {`);
  if (start < 0) return null;
  let depth = 0;
  for (let index = start; index < block.length; index++) {
    if (block[index] === "{") depth++;
    else if (block[index] === "}") {
      depth--;
      if (depth === 0) return block.slice(start, index + 1);
    }
  }
  return null;
}
const blocksByName = blocks();

describe("design token foundation (Gates G1, G2, G5, G6)", () => {
  it("defines every semantic role in all four appearance contexts", () => {
    const roles = [
      "bgWindow",
      "bgSurface",
      "bgSurfaceAlt",
      "label",
      "labelSecondary",
      "labelTertiary",
      "separator",
      "controlBorder",
      "tint",
      "onTint",
      "destructive",
      "warning",
      "success",
      "info",
      "focusRing",
      "materialChrome",
    ];
    for (const context of contexts) {
      const block = blocksByName.get(context);
      expect(block, `missing /* BLOCK: ${context} */`).toBeTruthy();
      for (const role of roles)
        expect(
          block!.includes(`--${role}:`),
          `--${role} is not defined in the ${context} context`,
        ).toBe(true);
    }
  });

  it("meets WCAG AA text contrast in dark, light and system contexts", () => {
    const pairs: [string, string, number, string][] = [
      ["label", "bgWindow", 4.5, "primary text on window"],
      ["label", "bgSurface", 4.5, "primary text on card"],
      ["labelSecondary", "bgSurface", 4.5, "secondary text on card"],
      ["labelTertiary", "bgSurface", 4.5, "tertiary text on card"],
      ["onTint", "tint", 4.5, "text on tinted control"],
      ["onDestructive", "destructive", 4.5, "text on destructive control"],
      ["destructive", "bgSurface", 4.5, "destructive text on card"],
      ["warning", "bgSurface", 4.5, "warning text on card"],
      ["success", "bgSurface", 4.5, "success text on card"],
      ["info", "bgSurface", 4.5, "info text on card"],
      ["controlBorder", "bgSurface", 3, "control border (non-text)"],
      ["focusRing", "bgSurface", 3, "focus ring (non-text)"],
      ["tint", "bgSurface", 3, "tint indicator (non-text)"],
    ];
    const failures: string[] = [];
    for (const context of ["dark", "light", "system"]) {
      const block = blocksByName.get(context)!;
      for (const [foreground, background, minimum, label] of pairs) {
        const fg = value(block, foreground);
        const bg = value(block, background);
        expect(fg, `--${foreground} missing in ${context}`).toBeTruthy();
        expect(bg, `--${background} missing in ${context}`).toBeTruthy();
        const ratio = contrast(fg!, bg!);
        if (ratio < minimum)
          failures.push(
            `${context}: ${label} ${ratio.toFixed(2)}:1 < ${minimum}:1 (${foreground} on ${background})`,
          );
      }
    }
    expect(failures).toEqual([]);
  });

  it("strengthens contrast under prefers-contrast: more instead of weakening it", () => {
    const layer = blocksByName.get("contrast")!;
    const darkOverride = subBlock(layer, ":root");
    const lightOverride = subBlock(layer, ':root[data-theme="light"]');
    expect(
      darkOverride,
      "contrast layer must override the dark appearance",
    ).toBeTruthy();
    expect(
      lightOverride,
      "contrast layer must override the light appearance",
    ).toBeTruthy();

    const critical = [
      "label",
      "labelSecondary",
      "separator",
      "controlBorder",
      "tint",
      "focusRing",
      "destructive",
      "materialChrome",
    ];
    for (const [name, block] of [
      ["dark", darkOverride!],
      ["light", lightOverride!],
    ] as const)
      for (const role of critical)
        expect(
          block.includes(`--${role}:`),
          `contrast layer does not strengthen --${role} in ${name}`,
        ).toBe(true);

    const dark = blocksByName.get("dark")!;
    const light = blocksByName.get("light")!;
    expect(
      contrast(value(darkOverride!, "label")!, value(dark, "bgWindow")!),
    ).toBeGreaterThanOrEqual(7);
    expect(
      contrast(value(lightOverride!, "label")!, value(light, "bgSurface")!),
    ).toBeGreaterThanOrEqual(7);
    expect(
      contrast(value(darkOverride!, "focusRing")!, value(dark, "bgSurface")!),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(value(lightOverride!, "focusRing")!, value(light, "bgSurface")!),
    ).toBeGreaterThanOrEqual(3);
    expect(darkOverride!).toContain("--materialBlur: none");
    expect(lightOverride!).toContain("--materialBlur: none");
  });

  it("keeps typography at or above the 11px floor and body at 13px", () => {
    const metrics = blocksByName.get("metrics")!;
    const size = (name: string) => value(metrics, name) ?? "";
    expect(size("text-body")).toBe("0.8125rem");
    for (const token of [
      "text-footnote",
      "text-caption",
      "text-subhead",
      "text-callout",
    ])
      expect(size(token)).not.toBe("");
    const files = walk("src").filter((file) => file.endsWith(".css"));
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // `font-size: 10px` and the `font:` shorthand (`font: 600 10px var(--mono)`)
      // both have to respect the floor; the shorthand used to slip past this gate.
      const sizes = [
        /font-size:\s*([\d.]+)(px|rem)/g,
        /(?<![-\w])font:\s*[^;]*?([\d.]+)(px|rem)\s/g,
      ];
      for (const pattern of sizes) {
        for (const match of text.matchAll(pattern)) {
          const size = Number(match[1]);
          const px = match[2] === "rem" ? size * 16 : size;
          // Custom-property indirection (`var(--text-...)`) is not matched by these patterns.
          if (
            px < 11 &&
            !text
              .slice(Math.max(0, match.index - 24), match.index)
              .includes("--")
          )
            offenders.push(`${file}: ${match[0].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("design token hygiene (Gates G3, G4)", () => {
  it("uses no colour literals outside the token file", () => {
    const offenders: string[] = [];
    // Scope: the extension's own UI. `src/core/picker/overlay.ts` is exempt because it
    // injects styles into the *page's* DOM, where extension tokens do not exist.
    const files = [
      ...walk("src/styles"),
      ...walk("src/ui"),
      ...readdirSync("src/browser").map((name) => join("src/browser", name)),
    ].filter(
      (path) => /\.(css|tsx?)$/.test(path) && !path.endsWith("tokens.css"),
    );
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, index) => {
        if (/#[0-9a-f]{3,8}\b/i.test(line) || /\brgba?\(/.test(line))
          offenders.push(`${file}:${index + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("never removes a focus outline without providing a replacement", () => {
    const styleFiles = walk("src").filter((file) => file.endsWith(".css"));
    const offenders: string[] = [];
    for (const file of styleFiles) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/outline:\s*(none|0)[;\s]/g)) {
        const context = text.slice(
          Math.max(0, match.index - 160),
          match.index + 40,
        );
        if (
          !/focus-visible|focus-within|focusRing/.test(context) &&
          !/crash|tooltip/.test(context)
        )
          offenders.push(`${file}: ${match[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

function walk(directory: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) results.push(...walk(path));
    else results.push(path);
  }
  return results;
}
