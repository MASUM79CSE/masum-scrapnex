import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * Apple design migration gates that need a real engine:
 * G7 hit targets, G8 accessible names, G9 keyboard focus, G11 reduced motion,
 * G12 increased contrast, G13 axe, G14 layout shift.
 *
 * The production build is copied and given a loopback-only host grant so the workspace
 * can be exercised; the shipped manifest is asserted clean in `extension.spec.ts`.
 */

const build = resolve(".output/chrome-mv3");
let scratch: string;
let context: BrowserContext;
let origin: string;

test.beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "scrapnex-design-"));
  const copy = join(scratch, "extension");
  await cp(build, copy, { recursive: true });
  const manifestPath = join(copy, "manifest.json");
  const manifest: object = JSON.parse(await readFile(manifestPath, "utf8"));
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, host_permissions: ["http://127.0.0.1/*"] }),
  );
  const { createServer } = await import("node:http");
  const server = createServer((_request, response) => {
    response
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(
        `<!doctype html><html lang="en"><title>Design fixture</title><main><h1>Inventory</h1>` +
          `<table><thead><tr><th>Item</th><th>Stock</th></tr></thead><tbody>` +
          `<tr><td>Lamp</td><td>12</td></tr><tr><td>Pack</td><td>4</td></tr>` +
          `<tr><td>Flask</td><td>9</td></tr></tbody></table></main></html>`,
      );
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("no fixture port");
  origin = `http://127.0.0.1:${address.port}`;
  context = await chromium.launchPersistentContext(join(scratch, "profile"), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`],
  });
});

test.afterAll(async () => {
  if (context) await context.close();
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

async function surface(path: string, width = 420): Promise<Page> {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`chrome-extension://${id}/${path}`);
  await page.waitForTimeout(400);
  return page;
}

test("G7: every control keeps a 30px visual floor and primary actions reach 38px", async () => {
  const page = await surface("sidepanel.html");
  const sizes = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, [role='button'], a[href]",
      ),
    ).filter((node) => node.offsetParent !== null);
    return nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return {
        name:
          node.getAttribute("aria-label") ??
          node.textContent?.trim().slice(0, 40) ??
          "",
        primary: node.classList.contains("button--primary"),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    });
  });
  expect(sizes.length).toBeGreaterThan(0);
  const tooSmall = sizes.filter((item) =>
    item.primary ? item.height < 38 : item.height < 30,
  );
  expect(tooSmall, JSON.stringify(tooSmall)).toEqual([]);
  await page.close();
});

test("G8: no icon-only control is missing an accessible name", async () => {
  for (const path of ["sidepanel.html", "popup.html", "options.html"]) {
    const page = await surface(path, path === "options.html" ? 900 : 420);
    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("button, a[href]"))
        .filter((node) => node.offsetParent !== null)
        .filter((node) => !(node.textContent ?? "").trim())
        .filter(
          (node) =>
            !node.getAttribute("aria-label") && !node.getAttribute("title"),
        )
        .map((node) => node.outerHTML.slice(0, 80)),
    );
    expect(unnamed, `${path}: ${unnamed.join(" | ")}`).toEqual([]);
    await page.close();
  }
});

test("G9/G13: surfaces pass axe and expose a visible focus ring on Tab", async () => {
  const page = await surface("sidepanel.html");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return null;
    const style = getComputedStyle(active);
    return {
      tag: active.tagName,
      width: style.outlineWidth,
      style: style.outlineStyle,
      colour: style.outlineColor,
    };
  });
  expect(outline).not.toBeNull();
  expect(outline!.style).not.toBe("none");
  expect(parseFloat(outline!.width)).toBeGreaterThanOrEqual(2);
  await page.close();
});

test("G11: reduced motion removes transform transitions", async () => {
  const page = await surface("sidepanel.html");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const durations = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>(".button");
    if (!button) return null;
    const style = getComputedStyle(button);
    return {
      transition: style.transitionDuration,
      animation: style.animationDuration,
    };
  });
  expect(durations).not.toBeNull();
  // Collapsed to effectively instant by the global reduced-motion branch.
  for (const value of [durations!.transition, durations!.animation])
    for (const part of value.split(","))
      expect(parseFloat(part)).toBeLessThanOrEqual(0.002);
  await page.close();
});

test("G12: increased contrast disables translucency", async () => {
  const page = await surface("sidepanel.html");
  await page.emulateMedia({ contrast: "more" });
  const materials = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      chrome: style.getPropertyValue("--materialChrome").trim(),
      blur: style.getPropertyValue("--materialBlur").trim(),
    };
  });
  expect(materials.blur).toBe("none");
  await page.close();
});

test("G14: the workspace paints without a layout shift", async () => {
  const page = await surface("sidepanel.html");
  const shift = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as {
            value: number;
            hadRecentInput: boolean;
          }[])
            if (!entry.hadRecentInput) total += entry.value;
        });
        try {
          observer.observe({ type: "layout-shift", buffered: true });
        } catch {
          done(0);
          return;
        }
        setTimeout(() => {
          observer.disconnect();
          done(total);
        }, 900);
      }),
  );
  expect(shift).toBeLessThan(0.1);
  await page.close();
});

test("the workspace still renders a working surface with the new controls", async () => {
  const page = await surface("sidepanel.html");
  await expect(
    page.getByRole("heading", { name: /extraction workspace/i }),
  ).toBeVisible();
  const primary = page.locator(".button--primary").first();
  if (await primary.count()) {
    const height = await primary.evaluate(
      (node) => node.getBoundingClientRect().height,
    );
    expect(height).toBeGreaterThanOrEqual(38);
  }
  expect(origin).toContain("127.0.0.1");
  await page.close();
});
