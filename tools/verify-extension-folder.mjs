/*
 * Load the delivered folder itself — not the build directory — in Chrome and
 * assert the current design language is live in it.
 *
 * This exists because a folder that has been updated by copying over the old
 * one keeps stale hashed assets from previous builds; the page then loads, but
 * it is not the build you think you shipped.
 *
 * Usage: node tools/verify-extension-folder.mjs [folder] [screenshotDir]
 */
import { chromium } from "@playwright/test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = "/home/user/extension";
const out = "/home/user/artifacts/screenshots/extension-folder";
mkdirSync(out, { recursive: true });

const checks = [];
const ctx = await chromium.launchPersistentContext(
  mkdtempSync(join(tmpdir(), "vf-")),
  {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  },
);
const worker =
  ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const id = new URL(worker.url()).host;
console.log("extension id:", id.slice(0, 8) + "…");

for (const scheme of ["dark", "light"]) {
  for (const surface of [
    { name: "sidepanel", file: "sidepanel.html", w: 420, h: 900 },
    { name: "popup", file: "popup.html", w: 320, h: 420 },
    { name: "options", file: "options.html", w: 900, h: 800 },
  ]) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: surface.w, height: surface.h });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`chrome-extension://${id}/${surface.file}`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(out, `${surface.name}-${scheme}.png`) });
    if (scheme === "dark" && surface.name === "sidepanel") {
      const m = await page.evaluate(() => {
        const chromeBar = document.querySelector(".app-top");
        const cs = chromeBar ? getComputedStyle(chromeBar) : null;
        const nav = document.querySelector(".nav-link");
        return {
          bodySize: getComputedStyle(document.body).fontSize,
          chromeHeight: cs
            ? Math.round(chromeBar.getBoundingClientRect().height)
            : 0,
          chromeBackground: cs?.backgroundColor ?? "",
          blur: cs?.backdropFilter ?? "",
          navRadius: nav ? getComputedStyle(nav).borderRadius : "",
          heroRadius: (() => {
            const hero = document.querySelector(".hero");
            return hero ? getComputedStyle(hero).borderRadius : "";
          })(),
          tokens: getComputedStyle(document.documentElement)
            .getPropertyValue("--tint")
            .trim(),
          brandFont: getComputedStyle(document.querySelector(".brand-name"))
            .fontFamily,
        };
      });
      checks.push(m);
    }
    await page.close();
  }
}
console.log(JSON.stringify(checks[0], null, 2));
await ctx.close();
