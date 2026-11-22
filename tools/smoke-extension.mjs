/*
 * Smoke-test an unpacked build folder in real Chromium: service worker registers,
 * popup/side panel/options render, and the side panel survives a reload without errors.
 *
 * Usage: node tools/smoke-extension.mjs [build-folder]   (default: /home/user/extension)
 */
import { chromium } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = process.argv[2] ?? "/home/user/extension";
const context = await chromium.launchPersistentContext(
  mkdtempSync(join(tmpdir(), "smoke-")),
  {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  },
);
const worker =
  context.serviceWorkers().find((w) => w.url().endsWith("/background.js")) ??
  (await context.waitForEvent("serviceworker", {
    predicate: (w) => w.url().endsWith("/background.js"),
    timeout: 15000,
  }));
const id = new URL(worker.url()).host;
console.log("service worker:", "OK", id);

const page = await context.newPage();
await page.goto(`chrome-extension://${id}/sidepanel.html`);
const heading = await page.locator("h1").first().innerText();
const badge = await page.locator(".build-tag").innerText();
console.log("sidepanel heading:", JSON.stringify(heading.trim()));
console.log(
  "version badge:",
  JSON.stringify(badge.replace(/\s+/g, " ").trim()),
);

const popup = await context.newPage();
await popup.goto(`chrome-extension://${id}/popup.html`);
console.log(
  "popup renders:",
  (await popup.locator("body").innerText()).length > 20 ? "OK" : "EMPTY",
);

const options = await context.newPage();
await options.goto(`chrome-extension://${id}/options.html`);
console.log(
  "options renders:",
  (await options.locator("body").innerText()).length > 20 ? "OK" : "EMPTY",
);

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.reload();
console.log("page errors after reload:", errors.length);
await context.close();
