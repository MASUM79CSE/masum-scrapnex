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
 * Phase E gates for flows and overlays: G9 (keyboard, Escape dismissal, focus
 * return), G11 (reduced motion reaches the toast) and G13 on the history view,
 * which is where the save, import and export sheets live.
 */

const build = resolve(".output/chrome-mv3");
let scratch: string;
let context: BrowserContext;

test.beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "scrapnex-flows-"));
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

async function surface(path = "sidepanel.html", width = 900): Promise<Page> {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`chrome-extension://${id}/${path}`);
  await page.waitForTimeout(350);
  return page;
}

test("G9: Escape closes an open sheet and returns focus to its summary", async () => {
  const page = await surface();
  const summary = page.getByText("Multi-URL queue", { exact: true }).first();
  await summary.click();
  const sheet = page
    .locator("details.export-panel")
    .filter({ hasText: "Multi-URL queue" })
    .first();
  await expect(sheet).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(sheet).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  await page.close();
});

test("G9: Escape also dismisses a sheet while typing inside it", async () => {
  const page = await surface();
  const summary = page.getByText("Multi-URL queue", { exact: true }).first();
  await summary.click();
  const sheet = page
    .locator("details.export-panel")
    .filter({ hasText: "Multi-URL queue" })
    .first();
  const field = sheet.getByRole("textbox").first();
  await field.click();
  await field.type("https://example.com/a");
  await page.keyboard.press("Escape");
  await expect(sheet).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  await page.close();
});

test("G9: a sheet opens and closes with the keyboard alone", async () => {
  const page = await surface();
  const sheet = page
    .locator("details.export-panel")
    .filter({ hasText: "Multi-URL queue" })
    .first();
  const summary = sheet.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(sheet).toHaveAttribute("open", "");
  const outline = await summary.evaluate((node) => {
    const style = getComputedStyle(node);
    return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect(sheet).not.toHaveAttribute("open", "");
  await page.close();
});

test("G7: every sheet summary is a full-height row", async () => {
  const page = await surface();
  const heights = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>("details.export-panel > summary"),
    )
      .filter((node) => node.offsetParent !== null)
      .map((node) => ({
        label: node.textContent?.trim().slice(0, 30) ?? "",
        height: Math.round(node.getBoundingClientRect().height),
      })),
  );
  expect(heights.length).toBeGreaterThan(0);
  expect(
    heights.filter((row) => row.height < 38),
    JSON.stringify(heights),
  ).toEqual([]);
  await page.close();
});

test("G11: reduced motion removes the toast entrance", async () => {
  const page = await surface();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const motion = await page.evaluate(() => {
    const toast = document.createElement("p");
    toast.className = "library-feedback";
    toast.setAttribute("role", "status");
    document.body.append(toast);
    const style = getComputedStyle(toast);
    const value = {
      animation: style.animationDuration,
      transition: style.transitionDuration,
    };
    toast.remove();
    return value;
  });
  for (const part of motion.animation.split(","))
    expect(parseFloat(part)).toBeLessThanOrEqual(0.002);
  await page.close();
});

test("G13: the history and settings views pass axe with their sheets open", async () => {
  const page = await surface();
  await page
    .getByRole("button", { name: "Local history", exact: true })
    .click();
  await page.waitForTimeout(250);
  // Open every sheet: a closed sheet hides its content from axe.
  await page.evaluate(() => {
    for (const details of document.querySelectorAll<HTMLDetailsElement>(
      "details.export-panel",
    ))
      details.open = true;
  });
  await page.waitForTimeout(200);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    ),
  ).toEqual([]);
  await page.close();
});

test("G13: the options page passes axe with every sheet open", async () => {
  const page = await surface("options.html");
  await page.evaluate(() => {
    for (const details of document.querySelectorAll<HTMLDetailsElement>(
      "details",
    ))
      details.open = true;
  });
  await page.waitForTimeout(200);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
  await page.close();
});

test("F: reduced motion also disables the selection spring", async () => {
  const page = await surface();
  await page.getByRole("button", { name: "Try sample data" }).first().click();
  await page.waitForTimeout(300);
  const motion = await page.evaluate(() => {
    const dot = document.querySelector<HTMLElement>(
      ".candidate:has(input:checked) .radio-dot",
    );
    if (!dot) return null;
    return getComputedStyle(dot).animationName;
  });
  expect(motion).toBe("dot-settle");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => {
    const dot = document.querySelector<HTMLElement>(
      ".candidate:has(input:checked) .radio-dot",
    );
    return dot ? getComputedStyle(dot).animationName : null;
  });
  expect(reduced).toBe("none");
  await page.close();
});

test("F: every icon is drawn at the same stroke weight", async () => {
  const page = await surface();
  const weights = await page.evaluate(() =>
    Array.from(document.querySelectorAll<SVGElement>("svg"))
      .filter((node) => node.getBoundingClientRect().width > 0)
      .map((node) => getComputedStyle(node).strokeWidth),
  );
  expect(weights.length).toBeGreaterThan(0);
  expect([...new Set(weights)]).toEqual(["2px"]);
  await page.close();
});
