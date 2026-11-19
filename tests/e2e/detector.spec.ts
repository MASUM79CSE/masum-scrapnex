import AxeBuilder from "@axe-core/playwright";
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
    const scale = req.url?.match(/^\/records\/(100|1000|10000)$/)?.[1];
    if (scale) {
      const rows = Array.from(
        { length: Number(scale) },
        (_, index) =>
          `<tr><td>Record ${index + 1}</td><td>${index + 1}</td></tr>`,
      ).join("");
      res
        .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(
          `<!doctype html><html lang="en"><title>Table scale fixture</title><main><table><thead><tr><th>Record</th><th>Quantity</th></tr></thead><tbody>${rows}</tbody></table></main></html>`,
        );
      return;
    }
    if (req.url === "/edit") {
      res
        .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(
          `<!doctype html><html lang="en"><title>Editable fixture</title><main><table><thead><tr><th>Item</th><th>Stock</th></tr></thead><tbody><tr><td>Lamp</td><td>10</td></tr><tr><td>Pack</td><td>2</td></tr><tr><td>Pack</td><td>2</td></tr><tr><td>সরঞ্জাম</td><td></td></tr><tr><td></td></tr><tr><td></td><td></td></tr></tbody></table></main></html>`,
        );
      return;
    }
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

async function liveTab(path: string) {
  const source = await context.newPage();
  await source.goto(`${origin}${path}`);
  await panel.reload();
  await source.bringToFront();
  await expect(
    panel.getByRole("button", { name: "Analyze page", exact: true }),
  ).toBeEnabled();
  return source;
}
async function panelClick(name: string) {
  await panel
    .getByRole("button", { name, exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
}
async function startCapture() {
  await panelClick("Analyze page");
  await expect(
    panel.getByRole("button", { name: "Collect records", exact: true }),
  ).toBeVisible();
  await panelClick("Collect records");
  await expect(
    panel.getByRole("heading", { name: "Working dataset" }),
  ).toBeVisible({ timeout: 15000 });
}

test("edits a real snapshot with keyboard, sorts, filters and manages columns and exact duplicates", async () => {
  test.setTimeout(50_000);
  await panel.setViewportSize({ width: 320, height: 900 });
  const page = await liveTab("/edit");
  try {
    await startCapture();
    await expect(
      panel.getByRole("heading", { name: "Captured records" }),
    ).toBeFocused();
    expect(
      await panel.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
    const table = panel.getByRole("table", { name: "Captured records" });
    await expect(table).toHaveAttribute("aria-rowcount", "7");
    await expect(table.getByRole("row").nth(5)).toContainText("—");
    await expect(table.getByRole("row").nth(6)).not.toContainText("—");
    await table.getByRole("button", { name: "Edit Item in row 1" }).focus();
    await panel.keyboard.press("Enter");
    const editor = panel.getByRole("form", { name: "Edit cell" });
    await expect(editor.getByRole("textbox")).toBeFocused();
    await editor.getByRole("textbox").fill("  ক্যাম্প ল্যাম্প  ");
    await editor.getByRole("button", { name: "Save cell" }).click();
    await expect(table).toContainText("ক্যাম্প ল্যাম্প");
    await expect(page.locator("tbody tr").first()).toContainText("Lamp");
    await panel.getByRole("button", { name: "Sort by Stock" }).click();
    await expect(
      table.getByRole("columnheader", { name: "Sort by Stock" }),
    ).toHaveAttribute("aria-sort", "ascending");
    await expect(table.getByRole("row").nth(4)).toContainText("Pack");
    await expect(table.getByRole("row").nth(5)).toContainText("ক্যাম্প ল্যাম্প");
    await panel
      .getByRole("combobox", { name: "Search column" })
      .selectOption({ label: "Item" });
    await panel.getByRole("searchbox", { name: "Search dataset" }).fill("pack");
    await expect(table).toHaveAttribute("aria-rowcount", "3");
    panel.once("dialog", (dialog) => void dialog.accept());
    await panel.getByRole("button", { name: "Remove duplicates" }).click();
    await expect(table).toHaveAttribute("aria-rowcount", "2");
    await panel.getByRole("searchbox", { name: "Search dataset" }).fill("");
    await panel
      .getByRole("combobox", { name: "Show rows" })
      .selectOption("empty");
    await expect(table).toHaveAttribute("aria-rowcount", "3");
    await panel
      .getByRole("combobox", { name: "Show rows" })
      .selectOption("all");
    await panel.getByText("Manage columns", { exact: true }).click();
    await panel
      .getByRole("combobox", { name: "Column", exact: true })
      .selectOption({ label: "Stock" });
    await panel.getByLabel("New column name").fill("Quantity");
    await panel.getByRole("button", { name: "Rename column" }).click();
    await panel.getByRole("button", { name: "Move left" }).click();
    await expect(table.getByRole("columnheader").nth(2)).toContainText(
      "Quantity",
    );
    panel.once("dialog", (dialog) => void dialog.accept());
    await panel
      .getByRole("button", { name: "Remove column", exact: true })
      .click();
    await expect(table.getByRole("columnheader")).toHaveCount(3);
    await panel
      .getByRole("checkbox", { name: "Select row 2", exact: true })
      .check();
    panel.once("dialog", (dialog) => void dialog.accept());
    await panel.getByRole("button", { name: "Delete selected rows" }).click();
    await expect(table).not.toContainText("Pack");
    const violations = (
      await new AxeBuilder({ page: panel })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((n) => n.target),
    }));
    expect(violations).toEqual([]);
    await panel.getByRole("button", { name: "Back to workspace" }).click();
    await panel.getByRole("button", { name: "Open working dataset" }).click();
    await expect(table).toContainText("ক্যাম্প ল্যাম্প");
    await panel.reload();
    await expect(
      panel.getByRole("heading", { name: "Working dataset" }),
    ).toHaveCount(0);
  } finally {
    await page.close();
    await panel.setViewportSize({ width: 1280, height: 720 });
  }
});

test("automatic collection refuses a stale sampled structure after page DOM changes", async () => {
  const page = await liveTab("/edit");
  try {
    await panelClick("Analyze page");
    await expect(
      panel.getByRole("button", { name: "Collect records", exact: true }),
    ).toBeVisible();
    await page
      .locator("td")
      .first()
      .evaluate((node) => {
        node.textContent = "Changed product";
      });
    await panelClick("Collect records");
    await expect(panel.getByRole("alert")).toContainText("Analyze or pick");
    await expect(
      panel.getByRole("heading", { name: "Working dataset" }),
    ).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test("captures repeated cards and keeps their image and link values inert", async () => {
  const page = await liveTab("/collections");
  try {
    await panelClick("Analyze page");
    await expect(panel.getByRole("radio", { name: /Product/ })).toBeVisible();
    await panel
      .getByRole("radio", { name: /Product/ })
      .first()
      .evaluate((el) => (el as HTMLInputElement).click());
    await panelClick("Collect records");
    const table = panel.getByRole("table", { name: "Captured records" });
    await expect(table).toContainText("৳8500");
    await expect(table).toContainText("/photos/lamp.png");
    await expect(table.getByRole("img")).toHaveCount(0);
    await expect(table.getByRole("link")).toHaveCount(0);
  } finally {
    await page.close();
    await panel.reload();
  }
});

for (const count of [100, 1000, 10000])
  test(`bounded table capture and virtual scrolling at ${count} source records`, async () => {
    const page = await liveTab(`/records/${count}`);
    try {
      const displayed = Math.min(count, 10000);
      const table = panel.getByRole("table", { name: "Captured records" });
      const grid = panel.getByRole("region", {
        name: "Virtualized dataset table",
      });
      await panelClick("Analyze page");
      await expect(
        panel.getByRole("button", { name: "Collect records", exact: true }),
      ).toBeVisible();
      const start = performance.now();
      await panelClick("Collect records");
      await expect(table).toHaveAttribute(
        "aria-rowcount",
        String(displayed + 1),
        { timeout: 16000 },
      );
      const capture = performance.now() - start;
      const initial = await table.locator("tbody tr[aria-rowindex]").count();
      expect(initial).toBeGreaterThan(0);
      expect(initial).toBeLessThanOrEqual(25);
      const jump = panel.getByLabel("Jump to row");
      await jump.fill(String(displayed));
      const jumpStart = performance.now();
      await jump.press("Enter");
      await expect(
        table.getByRole("button", {
          name: `Edit Record in row ${displayed}`,
          exact: true,
        }),
      ).toBeInViewport();
      const jumpMs = performance.now() - jumpStart;
      expect(
        await table.locator("tbody tr[aria-rowindex]").count(),
      ).toBeLessThanOrEqual(25);
      await expect(grid).toBeFocused();
      console.log(
        `PHASE07_SCALE input=${count} captured=${displayed} initial_dom_rows=${initial} capture_to_grid_ms=${capture.toFixed(1)} keyboard_jump_ms=${jumpMs.toFixed(1)}`,
      );
      if (count === 1000 && process.env.PHASE7_SCREENSHOT) {
        await panel.setViewportSize({ width: 1120, height: 950 });
        await panel.emulateMedia({ colorScheme: "dark" });
        await panel.evaluate(() => document.fonts.ready);
        await jump.fill("988");
        await jump.press("Enter");
        await expect(
          table.getByRole("button", {
            name: "Edit Record in row 988",
            exact: true,
          }),
        ).toBeInViewport();
        await table
          .getByRole("button", { name: "Edit Record in row 988", exact: true })
          .click();
        await panel
          .getByRole("form", { name: "Edit cell" })
          .getByRole("textbox")
          .fill("Verified field record");
        await panel.screenshot({
          path: process.env.PHASE7_SCREENSHOT,
          fullPage: true,
        });
        await panel.setViewportSize({ width: 1280, height: 720 });
      }
    } finally {
      await page.close();
      await panel.reload();
    }
  });
