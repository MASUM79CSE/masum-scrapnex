/*
 * Capture the extension surfaces in both appearances for design review and baselines.
 * Usage: node tools/capture-ui.mjs [buildFolder] [outputDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = process.argv[2] ?? "/home/user/extension";
const out = process.argv[3] ?? "/home/user/artifacts/screenshots/apple";
mkdirSync(out, { recursive: true });

const surfaces = [
  { name: "sidepanel", path: "sidepanel.html", width: 420, height: 900 },
  {
    // The data surfaces only exist once something has been captured, so the
    // sample run is captured separately instead of pretending the empty panel
    // represents the product.
    name: "sidepanel-data",
    path: "sidepanel.html",
    width: 420,
    height: 1200,
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "Try sample data" })
        .first()
        .click();
      await page.waitForTimeout(500);
    },
  },
  {
    // History is where the save, import and export sheets live.
    name: "sidepanel-history",
    path: "sidepanel.html",
    width: 900,
    height: 1000,
    prepare: async (page) => {
      await page.getByRole("button", { name: "Local history" }).click();
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const sheet = document.querySelector("details.export-panel");
        if (sheet) sheet.open = true;
      });
      await page.waitForTimeout(200);
    },
  },
  { name: "popup", path: "popup.html", width: 320, height: 420 },
  { name: "options", path: "options.html", width: 900, height: 800 },
];

for (const scheme of ["dark", "light"]) {
  const ctx = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), `cap-${scheme}-`)),
    {
      channel: "chromium",
      headless: true,
      colorScheme: scheme,
      args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
    },
  );
  const worker =
    ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  for (const surface of surfaces) {
    const page = await ctx.newPage();
    await page.setViewportSize({
      width: surface.width,
      height: surface.height,
    });
    await page.goto(`chrome-extension://${id}/${surface.path}`);
    await page.waitForTimeout(700);
    if (surface.prepare) await surface.prepare(page);
    const file = join(out, `${surface.name}-${scheme}.png`);
    await page.screenshot({ path: file });
    console.log("captured", file);
    await page.close();
  }
  await ctx.close();
}
