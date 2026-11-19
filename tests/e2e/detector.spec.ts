import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { browser as BrowserApi } from "wxt/browser";
import {
  isPageDetection,
  type PageDetection,
} from "../../src/core/detector/contracts";

const build = resolve(".output/chrome-mv3");
let scratch: string;
let context: BrowserContext;
let server: Server;
let origin: string;
let extension: string;
let panel: Page;

// This test uses a COPY of the production build with a loopback-only test permission.
// The production manifest tests assert that the shipped build has no host grants.
test.beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "scrapnex-detection-"));
  const copy = join(scratch, "extension");
  await cp(build, copy, { recursive: true });
  const path = join(copy, "manifest.json");
  const manifest: object = JSON.parse(await readFile(path, "utf8"));
  await writeFile(
    path,
    JSON.stringify({ ...manifest, host_permissions: ["http://127.0.0.1/*"] }),
  );
  server = createServer((req, res) => {
    const route = req.url?.match(/^\/(tables|collections|no-results)$/)?.[1];
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    void readFile(resolve(`tests/fixtures/detector/${route}.html`)).then(
      (body) =>
        res
          .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
          .end(body),
      () => res.writeHead(500).end(),
    );
  });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture server address");
  origin = `http://127.0.0.1:${address.port}`;
  context = await chromium.launchPersistentContext(join(scratch, "profile"), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`],
  });
  const worker =
    context
      .serviceWorkers()
      .find((worker) => worker.url().endsWith("/background.js")) ??
    (await context.waitForEvent("serviceworker", {
      predicate: (worker) => worker.url().endsWith("/background.js"),
      timeout: 10000,
    }));
  extension = `chrome-extension://${new URL(worker.url()).host}`;
  panel = await context.newPage();
  await panel.goto(`${extension}/sidepanel.html`);
});

test.afterAll(async () => {
  if (context) await context.close();
  if (server) await new Promise<void>((done) => server.close(() => done()));
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

async function report(route: string): Promise<PageDetection> {
  const page = await context.newPage();
  try {
    const url = `${origin}/${route}`;
    await page.goto(url);
    const result = await panel.evaluate(async (url) => {
      const chrome = (window as unknown as { chrome: typeof BrowserApi })
        .chrome;
      const tab = (await chrome.tabs.query({ url })).find(
        (item) => item.url === url,
      );
      if (tab?.id === undefined) throw new Error("Fixture tab missing");
      const [response] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        files: ["/page-agent.js"],
      });
      if (response?.frameId !== 0) throw new Error("Wrong frame");
      return response.result as unknown;
    }, url);
    if (!isPageDetection(result))
      throw new Error(
        `Unexpected packaged agent result: ${JSON.stringify(result)}`,
      );
    return result;
  } finally {
    await page.close();
  }
}

test("packaged detector previews merged, headerless and sparse native HTML tables", async () => {
  const result = await report("tables");
  expect(result.status).toBe("complete");
  const tables = result.candidates.filter(({ kind }) => kind === "table");
  expect(tables).toHaveLength(2);
  expect(tables[0]?.columns.map(({ label }) => label)).toEqual([
    "Item",
    "Stock / Warehouse",
    "Stock / Shop",
  ]);
  expect(tables[0]?.rows).toEqual([
    ["Trail lamp", "12", "3"],
    ["Trail lamp", "4", ""],
    ["সরঞ্জাম", "7", null],
    ["Camp mat", null, "5"],
  ]);
  expect(tables[1]?.columns.map(({ label }) => label)).toEqual([
    "Column 1",
    "Column 2",
  ]);
  expect(tables[1]?.rows).toEqual([
    ["Pack", "৳4000"],
    ["Mug", "৳850"],
  ]);
  expect(JSON.stringify(result)).not.toMatch(
    /layout cell|inventory footer|hidden quantity/i,
  );
});

test("recognizes product, article, directory, list and card structures and infers recurring fields", async () => {
  const result = await report("collections");
  expect(result.candidates.map(({ kind }) => kind)).toEqual(
    expect.arrayContaining([
      "products",
      "articles",
      "directory",
      "list",
      "cards",
    ]),
  );
  const product = result.candidates.find(({ kind }) => kind === "products");
  expect(product?.columns.map(({ label }) => label)).toEqual(
    expect.arrayContaining([
      "Product name",
      "Price",
      "Description",
      "Link",
      "Image URL",
    ]),
  );
  const price =
    product?.columns.findIndex(({ label }) => label === "Price") ?? -1;
  const link =
    product?.columns.findIndex(({ label }) => label === "Link") ?? -1;
  const image =
    product?.columns.findIndex(({ label }) => label === "Image URL") ?? -1;
  expect(product?.rows[0]?.[price]).toBe("$42.00");
  expect(product?.rows[1]?.[price]).toBe("৳8500");
  expect(product?.rows[2]?.[link]).toBeNull();
  expect(product?.rows[2]?.[image]).toBeNull();
  expect(product?.rows[0]?.[image]).toBe(`${origin}/photos/lamp.png`);
  expect(
    result.candidates
      .find(({ kind }) => kind === "directory")
      ?.columns.map(({ label }) => label),
  ).toContain("Address");
  expect(
    result.candidates
      .find(({ kind }) => kind === "articles")
      ?.columns.map(({ label }) => label),
  ).toContain("Date");
  expect(JSON.stringify(result)).not.toMatch(
    /Nav A|private fixture form|hidden\.png|javascript:|data:image/,
  );
});

test("navigation, controls and empty repeated containers do not produce candidates", async () => {
  expect(await report("no-results")).toMatchObject({
    status: "complete",
    candidates: [],
  });
});

test("workspace scans only after explicit action, presents real candidates and clears stale previews", async () => {
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/tables`);
    await page.bringToFront();
    await expect(
      panel.getByRole("button", { name: "Analyze page" }),
    ).toBeVisible();
    await expect(panel.getByRole("table")).toHaveCount(0);
    // The extension panel document is tested as a separate tab. Preserve the fixture as
    // the active tab while triggering its React click handler.
    await panel
      .getByRole("button", { name: "Analyze page" })
      .evaluate((button) => (button as HTMLButtonElement).click());
    await expect(
      panel.getByRole("table", { name: "HTML table preview" }),
    ).toBeVisible();
    await expect(panel.getByRole("cell", { name: "সরঞ্জাম" })).toBeVisible();
    await panel
      .getByText("Why this structure was ranked")
      .evaluate((summary) => (summary as HTMLElement).click());
    await expect(
      panel.getByText("Merged cells are projected into a rectangular preview."),
    ).toBeVisible();
    if (process.env.PHASE5_SCREENSHOT) {
      await panel.setViewportSize({ width: 1440, height: 940 });
      await panel.evaluate(() => document.fonts.ready);
      await panel.screenshot({
        path: process.env.PHASE5_SCREENSHOT,
        fullPage: true,
      });
    }
    await page.goto(`${origin}/no-results`);
    await expect(panel.getByRole("table")).toHaveCount(0);
    await expect(panel.getByText("No candidates yet")).toBeVisible();
  } finally {
    await page.close();
  }
});
