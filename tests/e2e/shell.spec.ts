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
 * Phase C gates for the shell: G10 (no horizontal scroll at 320 px, no clipping
 * at 200 % zoom), G13 across all three surfaces at both widths, plus shell
 * assertions that only exist here — a navigation bar that never wraps, chrome
 * that stays pinned, and an opaque fallback when materials are disabled.
 *
 * 200 % browser zoom is emulated as a halved CSS viewport (320 px from a 640 px
 * window): that is the reflow a real zoom produces. Page-scale zoom does not
 * reflow, so asserting on it would prove nothing.
 */

const build = resolve(".output/chrome-mv3");
let scratch: string;
let context: BrowserContext;

test.beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "scrapnex-shell-"));
  const copy = join(scratch, "extension");
  await cp(build, copy, { recursive: true });
  const manifestPath = join(copy, "manifest.json");
  const manifest: object = JSON.parse(await readFile(manifestPath, "utf8"));
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, host_permissions: ["http://127.0.0.1/*"] }),
  );
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

async function surface(path: string, width = 420, height = 900): Promise<Page> {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${id}/${path}`);
  await page.waitForTimeout(350);
  return page;
}

test("G10: no horizontal overflow at 320 px on any surface", async () => {
  for (const path of ["sidepanel.html", "popup.html", "options.html"]) {
    const page = await surface(path, 320);
    const report = await page.evaluate(() => {
      // A control that sits inside a deliberately scrollable region is allowed to
      // be off-screen; anything else must fit the viewport.
      function insideScroller(node: HTMLElement) {
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
          const style = getComputedStyle(parent);
          if (
            (style.overflowX === "auto" || style.overflowX === "scroll") &&
            parent.scrollWidth > parent.clientWidth + 1
          )
            return true;
          parent = parent.parentElement;
        }
        return false;
      }
      const overflowing = Array.from(
        document.querySelectorAll<HTMLElement>(
          "button, a[href], input, select, textarea",
        ),
      )
        .filter((node) => node.offsetParent !== null)
        .filter((node) => !insideScroller(node))
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            name: (
              node.getAttribute("aria-label") ??
              node.textContent ??
              node.tagName
            )
              .trim()
              .slice(0, 32),
            left: Math.round(box.left),
            right: Math.round(box.right),
          };
        })
        .filter((item) => item.right > window.innerWidth + 1 || item.left < -1);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        overflowing,
      };
    });
    expect(
      report.scrollWidth,
      `${path} scrolls horizontally at 320 px`,
    ).toBeLessThanOrEqual(report.innerWidth + 1);
    expect(
      report.overflowing,
      `${path}: ${JSON.stringify(report.overflowing)}`,
    ).toEqual([]);
    await page.close();
  }
});

test("G10: the two-column work grid stacks instead of clipping when narrowed", async () => {
  const page = await surface("sidepanel.html", 1100);
  await page.getByRole("button", { name: "Try sample data" }).first().click();
  await page.waitForTimeout(300);
  const columns = async () =>
    page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".work-grid");
      if (!grid) return 0;
      return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    });
  expect(await columns()).toBe(2);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(250);
  expect(await columns()).toBe(1);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(321);
  await page.close();
});

test("the compact tab bar keeps every tab on one row", async () => {
  for (const width of [320, 375, 420, 560, 680]) {
    const page = await surface("sidepanel.html", width);
    const geometry = await page.evaluate(() => {
      const tabs = Array.from(
        document.querySelectorAll<HTMLElement>(".nav-link"),
      ).map((node) => {
        const box = node.getBoundingClientRect();
        return { top: Math.round(box.top), width: Math.round(box.width) };
      });
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      return {
        tabs,
        scrollWidth: nav?.scrollWidth ?? 0,
        clientWidth: nav?.clientWidth ?? 0,
      };
    });
    expect(geometry.tabs.length).toBeGreaterThanOrEqual(4);
    const rows = new Set(geometry.tabs.map((tab) => tab.top));
    expect(rows.size, `tabs wrapped at ${width} px`).toBe(1);
    expect(
      geometry.scrollWidth,
      `tabs overflow the bar at ${width} px`,
    ).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(Math.min(...geometry.tabs.map((tab) => tab.width))).toBeGreaterThan(
      44,
    );
    await page.close();
  }
});

test("the wide sidebar lists every tab in one column", async () => {
  const page = await surface("sidepanel.html", 900);
  const geometry = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".nav-link")).map(
      (node) => {
        const box = node.getBoundingClientRect();
        return { left: Math.round(box.left), width: Math.round(box.width) };
      },
    ),
  );
  expect(new Set(geometry.map((tab) => tab.left)).size).toBe(1);
  expect(new Set(geometry.map((tab) => tab.width)).size).toBe(1);
  await page.close();
});

test("the toolbar and sidebar stay pinned while the panel scrolls", async () => {
  const page = await surface("sidepanel.html", 900, 420);
  await page.getByRole("button", { name: "Try sample data" }).first().click();
  await page.waitForTimeout(300);
  const scrolled = await page.evaluate(() => {
    window.scrollTo(0, 400);
    return window.scrollY;
  });
  expect(scrolled).toBeGreaterThan(0);
  const pinned = await page.evaluate(() => {
    const top = document
      .querySelector<HTMLElement>(".app-top")!
      .getBoundingClientRect().top;
    const side = document
      .querySelector<HTMLElement>(".sidebar")!
      .getBoundingClientRect().top;
    return { top: Math.round(top), side: Math.round(side) };
  });
  expect(Math.abs(pinned.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(pinned.side)).toBeLessThanOrEqual(1 + 51);
  await page.close();
});

test("disabled materials fall back to an opaque bar", async () => {
  for (const path of ["sidepanel.html", "popup.html"]) {
    const page = await surface(path, 420);
    await page.emulateMedia({ contrast: "more" });
    const chrome = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>(".app-top, .popup-top");
      if (!bar) return null;
      const style = getComputedStyle(bar);
      return { background: style.backgroundColor, blur: style.backdropFilter };
    });
    expect(chrome).not.toBeNull();
    expect(chrome!.blur).toBe("none");
    // `rgb(...)` means alpha 1; a translucent `rgba(...)` would let page content
    // show through with no blur to hide it.
    expect(chrome!.background).toMatch(
      /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
    );
    await page.close();
  }
});

test("each breakpoint exposes the label it actually shows", async () => {
  const wide = await surface("sidepanel.html", 1280);
  const wideNav = wide.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await expect(
    wideNav.getByRole("button", { name: "Data preview", exact: true }),
  ).toBeVisible();
  await expect(
    wideNav.getByRole("button", { name: "Local history", exact: true }),
  ).toBeVisible();
  await wide.close();

  const narrow = await surface("sidepanel.html", 420);
  const narrowNav = narrow.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await expect(
    narrowNav.getByRole("button", { name: "Preview", exact: true }),
  ).toBeVisible();
  await expect(
    narrowNav.getByRole("button", { name: "History", exact: true }),
  ).toBeVisible();
  // The long labels are out of the accessibility tree, so no duplicate names.
  await expect(
    narrowNav.getByRole("button", { name: "Data preview", exact: true }),
  ).toHaveCount(0);
  await narrow.close();
});

test("G13: every surface passes axe at compact and wide widths", async () => {
  const targets: Array<[string, number]> = [
    ["sidepanel.html", 420],
    ["sidepanel.html", 1280],
    ["popup.html", 320],
    ["options.html", 900],
    ["options.html", 320],
  ];
  for (const [path, width] of targets) {
    const page = await surface(path, width);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.length}`,
      ),
      `${path} at ${width} px`,
    ).toEqual([]);
    await page.close();
  }
});
