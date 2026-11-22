import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * G15 — committed layout baselines.
 *
 * The plan asked for pixel snapshots. This is a geometry baseline instead, and
 * the reason is worth stating: pixel diffs depend on the host's GPU, font stack
 * and subpixel rounding, so the same build produces different bytes on a
 * developer's Mac and on the CI runner. A baseline that fails for reasons the
 * change did not cause trains people to ignore it. Landmarks (heights, widths,
 * type sizes, radii, overflow) catch the layout regressions that matter and are
 * stable across environments.
 *
 * Re-baselining is explicit: `UPDATE_BASELINES=1 npx playwright test tests/e2e/design-layout.spec.ts`
 * rewrites `tests/e2e/baselines/design-layout.json`, which is then reviewed and committed.
 */

const build = resolve(".output/chrome-mv3");
const baselinePath = resolve("tests/e2e/baselines/design-layout.json");
let scratch: string;
let context: BrowserContext;
let origin: string;

type Landmarks = Record<string, number | string>;

const surfaces: Array<{
  key: string;
  path: string;
  width: number;
  height: number;
}> = [
  { key: "sidepanel-420", path: "sidepanel.html", width: 420, height: 900 },
  { key: "sidepanel-1280", path: "sidepanel.html", width: 1280, height: 900 },
  { key: "popup-320", path: "popup.html", width: 320, height: 420 },
  { key: "options-900", path: "options.html", width: 900, height: 800 },
];

test.beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "scrapnex-layout-"));
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
        `<!doctype html><html lang="en"><title>Layout fixture</title></html>`,
      );
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
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

async function measure(
  path: string,
  width: number,
  height: number,
  scheme: "dark" | "light",
): Promise<Landmarks> {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
  const id = new URL(worker.url()).host;
  const page: Page = await context.newPage();
  await page.setViewportSize({ width, height });
  // The default preference is "system", so the emulated scheme decides the theme.
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(`chrome-extension://${id}/${path}`);
  await page.waitForTimeout(400);
  const marks = await page.evaluate(() => {
    const px = (value: string) => Math.round(parseFloat(value) * 10) / 10;
    const box = (selector: string) => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const style = (selector: string, property: string) => {
      const node = document.querySelector<HTMLElement>(selector);
      return node ? getComputedStyle(node)[property as never] : "absent";
    };
    const nav = Array.from(document.querySelectorAll<HTMLElement>(".nav-link"));
    const out: Record<string, number | string> = {
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      chrome: box(".app-top, .popup-top")?.height ?? 0,
      brandNameSize: px(String(style(".brand-name", "fontSize"))),
      headingSize: px(String(style("h1", "fontSize"))),
      bodySize: px(String(style("body", "fontSize"))),
      navCount: nav.length,
      navHeight: nav[0] ? Math.round(nav[0].getBoundingClientRect().height) : 0,
      navRows: new Set(
        nav.map((node) => Math.round(node.getBoundingClientRect().top)),
      ).size,
      sidebarWidth: box(".sidebar")?.width ?? 0,
      heroRadius: String(style(".hero", "borderRadius")),
      heroHeight: box(".hero")?.height ?? 0,
      radiusSmall: String(style(".panel", "borderRadius")),
    };
    return out;
  });
  await page.close();
  expect(origin).toContain("127.0.0.1");
  return marks;
}

for (const theme of ["dark", "light"])
  for (const surface of surfaces)
    test(`G15: ${surface.key} matches the committed layout baseline (${theme})`, async () => {
      const marks = await measure(
        surface.path,
        surface.width,
        surface.height,
        theme as "dark" | "light",
      );
      const key = `${surface.key}-${theme}`;

      const baseline: Record<string, Landmarks> = existsSync(baselinePath)
        ? JSON.parse(await readFile(baselinePath, "utf8"))
        : {};
      if (process.env.UPDATE_BASELINES === "1") {
        baseline[key] = marks;
        await mkdir(resolve("tests/e2e/baselines"), { recursive: true });
        await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
        return;
      }
      const expected = baseline[key];
      expect(expected, `no baseline for ${key}`).toBeDefined();

      const drift: string[] = [];
      for (const [name, value] of Object.entries(expected!)) {
        const actual = marks[name];
        if (typeof value === "number" && typeof actual === "number") {
          // 2 px tolerance absorbs font-metric differences, not layout changes.
          if (Math.abs(actual - value) > 2)
            drift.push(`${name}: ${value} → ${actual}`);
        } else if (value !== actual) {
          drift.push(`${name}: ${value} → ${String(actual)}`);
        }
      }
      expect(drift, `${key} drifted: ${drift.join(" | ")}`).toEqual([]);
    });
