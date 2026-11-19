import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";

const build = resolve(".output/chrome-mv3");

test("production manifest exposes only the planned permissions and entrypoints", async () => {
  const manifest = JSON.parse(
    await readFile(join(build, "manifest.json"), "utf8"),
  );
  expect(manifest).toMatchObject({
    name: "MASUM SCRAPNEX",
    version: "0.1.0",
    manifest_version: 3,
    minimum_chrome_version: "116",
    action: { default_popup: "popup.html" },
    background: { service_worker: "background.js" },
    side_panel: { default_path: "sidepanel.html" },
    options_ui: { page: "options.html" },
  });
  expect([...manifest.permissions].sort()).toEqual(
    ["activeTab", "scripting", "sidePanel", "storage"].sort(),
  );
  for (const key of [
    "host_permissions",
    "optional_host_permissions",
    "content_scripts",
    "externally_connectable",
    "web_accessible_resources",
  ]) {
    expect(manifest[key], key).toBeUndefined();
  }
  expect((await stat(join(build, "page-agent.js"))).isFile()).toBe(true);
});

test("unpacked MV3 extension loads and the shell pages communicate with the worker", async () => {
  const profile = await mkdtemp(join(tmpdir(), "scrapnex-chromium-"));
  try {
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${build}`,
        `--load-extension=${build}`,
      ],
    });
    try {
      const existingWorker = context
        .serviceWorkers()
        .find((worker) => worker.url().endsWith("/background.js"));
      const worker =
        existingWorker ??
        (await context.waitForEvent("serviceworker", {
          predicate: (candidate) => candidate.url().endsWith("/background.js"),
          timeout: 10_000,
        }));
      const extensionId = new URL(worker.url()).hostname;
      expect(extensionId).toMatch(/^[a-p]{32}$/);
      const root = `chrome-extension://${extensionId}/`;
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto(`${root}popup.html`);
      await expect(
        page.getByRole("heading", { name: "MASUM SCRAPNEX" }),
      ).toBeVisible();
      // Loading its HTML as a tab does not simulate a toolbar-originated grant.
      await expect(
        page.getByRole("button", { name: "Open side panel" }),
      ).toBeDisabled();
      await expect(page.getByRole("status")).toHaveText(
        /No authorized web tab|This page is restricted/,
      );
      await expect(page.locator("main")).toHaveCSS("width", "288px");

      await page.goto(`${root}sidepanel.html`);
      await expect(page.getByRole("status")).toHaveText("Extension connected.");
      await expect(
        page.getByText("Webpage analysis is not available", { exact: false }),
      ).toBeVisible();

      await page.goto(`${root}options.html`);
      await expect(
        page.getByRole("heading", { name: "MASUM SCRAPNEX settings" }),
      ).toBeVisible();
      expect(pageErrors).toEqual([]);
      console.log(
        `Loaded unpacked extension in Chromium ${await page.evaluate(() => navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? "unknown")} (headless).`,
      );
    } finally {
      await context.close();
    }
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
