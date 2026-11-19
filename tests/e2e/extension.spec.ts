import { createServer } from "node:http";
import type { browser as BrowserApi } from "wxt/browser";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const build = resolve(".output/chrome-mv3");

test("production manifest exposes only the planned permissions and entrypoints", async () => {
  const manifest = JSON.parse(
    await readFile(join(build, "manifest.json"), "utf8"),
  );
  expect(manifest).toMatchObject({
    name: "MASUM SCRAPNEXS",
    version: "0.1.0",
    manifest_version: 3,
    minimum_chrome_version: "116",
    action: { default_popup: "popup.html" },
    background: { service_worker: "background.js" },
    side_panel: { default_path: "sidepanel.html" },
    options_ui: { page: "options.html" },
    icons: {
      16: "icons/16.png",
      32: "icons/32.png",
      48: "icons/48.png",
      128: "icons/128.png",
    },
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
  expect((await stat(join(build, "picker.js"))).isFile()).toBe(true);
  expect((await stat(join(build, "collector.js"))).isFile()).toBe(true);
});

const smoke = test.extend<{
  shell: { page: Page; root: string; external: string[] };
}>({
  shell: async ({ headless }, use) => {
    const profile = await mkdtemp(join(tmpdir(), "scrapnex-chromium-"));
    try {
      const context = await chromium.launchPersistentContext(profile, {
        channel: "chromium",
        headless,
        args: [
          `--disable-extensions-except=${build}`,
          `--load-extension=${build}`,
        ],
      });
      try {
        const existing = context
          .serviceWorkers()
          .find((worker) => worker.url().endsWith("/background.js"));
        const worker =
          existing ??
          (await context.waitForEvent("serviceworker", {
            predicate: (candidate) =>
              candidate.url().endsWith("/background.js"),
            timeout: 10_000,
          }));
        const id = new URL(worker.url()).hostname;
        expect(id).toMatch(/^[a-p]{32}$/);
        const page = await context.newPage();
        const external: string[] = [];
        page.on("request", (request) => {
          if (/^https?:/.test(request.url())) external.push(request.url());
        });
        await use({ page, root: `chrome-extension://${id}/`, external });
      } finally {
        await context.close();
      }
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  },
});

async function checkAccess(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

smoke(
  "packaged popup and side panel render, connect and do not request external resources",
  async ({ shell: { page, root, external } }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${root}popup.html`);
    await expect(
      page.getByRole("heading", { name: "Open workspace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open side panel" }),
    ).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText(
      /No authorized web tab|This page is restricted/,
    );
    await expect(page.locator("main")).toHaveCSS("width", "360px");
    await checkAccess(page);

    await page.goto(`${root}sidepanel.html`);
    await expect(page.getByRole("status")).toHaveText("Extension connected");
    await expect(page.getByText("No candidates yet")).toBeVisible();
    await expect(page.getByText("No records to preview")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.fonts.check('14px "Inter Variable"')),
    ).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(external).toEqual([]);
  },
);

smoke(
  "sample candidates, navigation, search, sorting and row selection work",
  async ({ shell: { page, root } }) => {
    await page.goto(`${root}sidepanel.html`);
    await page.getByRole("button", { name: "Try sample data" }).click();
    await expect(page.getByText("Sample mode", { exact: true })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(7);
    await page.getByRole("button", { name: "Price", exact: true }).click();
    await expect(
      page.getByRole("columnheader", { name: "Price" }),
    ).toHaveAttribute("aria-sort", "ascending");
    await expect(page.getByRole("row").nth(1)).toContainText(
      "Summit Insulated Bottle",
    );
    await page
      .getByRole("checkbox", { name: "Select Summit Insulated Bottle" })
      .check();
    await expect(
      page.getByText("Showing 6 of 6 records · 1 selected"),
    ).toBeVisible();
    await page.getByRole("searchbox").fill("lantern");
    await expect(page.getByRole("row")).toHaveCount(2);
    await page.getByRole("searchbox").fill("no record matches");
    await expect(page.getByText("No records match your search.")).toBeVisible();
    await page.getByRole("button", { name: "Candidates", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Candidate structures" }),
    ).toBeFocused();
    await page.getByRole("radio", { name: /Product catalog/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("radio", { name: /Featured gear/ }),
    ).toBeChecked();
    await page.getByRole("button", { name: "View sample preview" }).click();
    await expect(
      page.getByRole("table", { name: "Featured gear sample records" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Exit sample" }).click();
    await expect(page.getByText("No records to preview")).toBeVisible();
  },
);

smoke(
  "themes persist in extension storage and reflect system color scheme",
  async ({ shell: { page, root } }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`${root}options.html`);
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: /System/ })).toBeChecked();
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
    await page.getByRole("radio", { name: /Dark/ }).click();
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await checkAccess(page);
    await page.reload();
    await expect(page.getByRole("radio", { name: /Dark/ })).toBeChecked();
    await page.getByRole("radio", { name: /Light/ }).click();
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
    await page.goto(`${root}sidepanel.html`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Try sample data" }).click();
    await checkAccess(page);
  },
);

smoke(
  "narrow side panel does not overflow, and the table scroll is keyboard reachable",
  async ({ shell: { page, root } }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(`${root}sidepanel.html`);
    await page.getByRole("heading", { name: "Extraction workspace" }).waitFor();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await page.getByRole("button", { name: "Try sample data" }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
    const table = page.getByRole("region", { name: /Sample data table/ });
    await table.focus();
    await expect(table).toBeFocused();
    expect(
      await table.evaluate((node) => node.scrollWidth > node.clientWidth),
    ).toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => table.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(0);
    await checkAccess(page);
  },
);

smoke(
  "production build has no loopback host grant and offers no scan before authorization",
  async ({ shell: { page, root } }) => {
    const server = createServer((_req, res) =>
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end("<main><h1>Controlled page</h1></main>"),
    );
    await new Promise<void>((done, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", done);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing fixture server");
    const local = await page.context().newPage();
    try {
      await page.goto(`${root}sidepanel.html`);
      await local.goto(`http://127.0.0.1:${address.port}/`);
      await local.bringToFront();
      await expect(
        page.getByText("No webpage connected for analysis"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Analyze page" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Pick elements" }),
      ).toHaveCount(0);
      const authority = await page.evaluate(async () => {
        const chrome = (window as unknown as { chrome: typeof BrowserApi })
          .chrome;
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        return {
          hostGrant: await chrome.permissions.contains({
            origins: ["http://127.0.0.1/*"],
          }),
          urlExposed: tab?.url !== undefined,
          activeTab: tab?.id !== undefined,
        };
      });
      expect(authority).toEqual({
        hostGrant: false,
        urlExposed: false,
        activeTab: true,
      });
    } finally {
      await local.close();
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    }
  },
);
