import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import type { browser as BrowserApi } from "wxt/browser";
import { build } from "vite";
import type {} from "../fixtures/library/harness";
import {
  defaultStorageSettings,
  libraryName,
  storageSettingsKey,
} from "../../src/core/library/contracts";
import type { Dataset } from "../../src/core/extraction/contracts";

const built = resolve(".output/chrome-mv3");
const fixture =
  '<html lang="en"><meta charset="utf-8"><title>Local library fixture</title><main><h1>Fieldwork inventory</h1><table><thead><tr><th>Item</th><th>Quantity</th></tr></thead><tbody><tr><td>Field lamp</td><td>03</td></tr><tr><td>Camp pack</td><td>7</td></tr><tr><td>সরঞ্জাম</td><td></td></tr></tbody></table><nav aria-label="Pagination"><a rel="next" href="/inventory?page=2">Next page</a></nav></main></html>';
const small: Dataset = {
  version: 1,
  columns: [{ id: "c1", kind: "text", label: "Entry" }],
  rows: [{ id: "r3", cells: ["Legacy বাংলা"] }],
};

async function fixtureServer() {
  const server: Server = createServer((req, res) => {
    if (req.url?.startsWith("/inventory"))
      res
        .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(
          req.url.includes("different=1")
            ? fixture.replace(
                "</tbody>",
                "<tr><td>Field lamp</td><td>03</td></tr></tbody>",
              )
            : fixture,
        );
    else res.writeHead(404).end();
  });
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture server has no port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}
async function extensionFixture(loopback = false) {
  const folder = await mkdtemp(join(tmpdir(), "scrapnex-library-"));
  const unpacked = join(folder, "extension"),
    profile = join(folder, "profile");
  await cp(built, unpacked, { recursive: true });
  if (loopback) {
    const manifest = join(unpacked, "manifest.json");
    const data = JSON.parse(await readFile(manifest, "utf8"));
    await writeFile(
      manifest,
      JSON.stringify({ ...data, host_permissions: ["http://127.0.0.1/*"] }),
    );
  }
  return {
    async launch() {
      return chromium.launchPersistentContext(profile, {
        channel: "chromium",
        headless: true,
        args: [
          `--disable-extensions-except=${unpacked}`,
          `--load-extension=${unpacked}`,
        ],
      });
    },
    async dispose() {
      await rm(folder, { recursive: true, force: true });
    },
  };
}
async function background(context: BrowserContext) {
  return (
    context.serviceWorkers().find((w) => w.url().endsWith("/background.js")) ??
    context.waitForEvent("serviceworker", {
      predicate: (w) => w.url().endsWith("/background.js"),
      timeout: 10_000,
    })
  );
}
async function openPanel(context: BrowserContext, origin: string) {
  const panel = await context.newPage();
  await panel.goto(`${origin}/sidepanel.html`);
  await expect(
    panel.getByText("Extension connected", { exact: true }),
  ).toBeVisible();
  return panel;
}
async function openSource(context: BrowserContext, panel: Page, url: string) {
  const page = await context.newPage();
  await page.goto(url);
  await page.bringToFront();
  await expect
    .poll(() =>
      panel.evaluate(async (expected) => {
        const chrome = (window as unknown as { chrome: typeof BrowserApi })
          .chrome;
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        return tab?.url === expected && tab.status === "complete";
      }, url),
    )
    .toBe(true);
  return page;
}
async function invoke(panel: Page, name: string) {
  const button = panel.getByRole("button", { name, exact: true });
  await expect(button).toBeEnabled();
  await button.evaluate((node) => (node as HTMLButtonElement).click());
}
async function legacy(worker: Worker, invalid = false) {
  await worker.evaluate(
    async ({ name, settings, dataset, invalid }) => {
      const scope = globalThis as unknown as { chrome: typeof BrowserApi };
      await scope.chrome.storage.local.set({
        [settings]: { version: 1, retentionDays: 7 },
      });
      await new Promise<void>((ok, fail) => {
        const request = indexedDB.open(name, 1);
        request.onerror = () => fail(request.error);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("sessions", {
            keyPath: "id",
          });
          store.add({
            id: "legacy-older",
            name: "Legacy inventory",
            savedAt: Date.now() - 14 * 86_400_000,
            partial: true,
            dataset: invalid ? { ...dataset, version: 99 } : dataset,
          });
          store.add({
            id: "legacy-recent",
            name: "Recent inventory",
            savedAt: Date.now(),
            dataset,
          });
        };
        request.onsuccess = () => {
          request.result.close();
          ok();
        };
      });
    },
    {
      name: libraryName,
      settings: storageSettingsKey,
      dataset: small,
      invalid,
    },
  );
}
function acceptDialog(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept());
}

// Collection in this workflow uses a loopback-only test permission on a build copy.
test("library saves actual edits and a recipe, restores after Chromium exits and restarts, and deletes both", async () => {
  test.setTimeout(85_000);
  const local = await extensionFixture(true),
    server = await fixtureServer();
  let browserContext: BrowserContext | undefined;
  try {
    browserContext = await local.launch();
    const worker = await background(browserContext);
    const root = `chrome-extension://${new URL(worker.url()).host}`;
    let panel = await openPanel(browserContext, root);
    let source = await openSource(
      browserContext,
      panel,
      `${server.origin}/inventory?private=never-store-this`,
    );
    await invoke(panel, "Analyze page");
    await panel
      .getByText("Save extraction configuration", { exact: true })
      .click();
    await panel.getByLabel("Configuration name").fill("Inventory schema");
    await invoke(panel, "Save configuration");
    await expect(
      panel.getByText("Saved configuration “Inventory schema”.", {
        exact: true,
      }),
    ).toBeVisible();
    await source.bringToFront();
    await invoke(panel, "Collect records");
    const table = panel.getByRole("table", { name: "Captured records" });
    await table.getByRole("button", { name: /^Edit Item in row 1:/ }).click();
    const editor = panel.getByRole("form", { name: "Edit cell" });
    await editor.getByRole("textbox").fill("Edited local lamp");
    await editor.getByRole("button", { name: "Save cell" }).click();
    await table
      .getByRole("checkbox", { name: "Select row 2", exact: true })
      .check();
    acceptDialog(panel);
    await panel
      .getByRole("button", { name: "Delete selected rows", exact: true })
      .click();
    await expect(table).not.toContainText("Camp pack");
    await panel.getByText("Save working snapshot", { exact: true }).click();
    await panel.getByLabel("Snapshot name").fill("Edited inventory");
    await panel
      .getByRole("button", { name: "Save snapshot", exact: true })
      .click();
    await expect(
      panel.getByText("Saved snapshot “Edited inventory” on this device.", {
        exact: true,
      }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Settings", exact: true }).click();
    await panel.getByLabel("Cleanup age").selectOption("90");
    await expect(
      panel.getByText("Cleanup preference saved on this device."),
    ).toBeVisible();
    await panel.getByLabel("Default export format").selectOption("json");
    await panel.getByLabel("Default additional actions").fill("2");
    await panel.getByLabel("Default delay (ms)").fill("1750");
    await panel
      .getByLabel("Remove exact duplicates from new single-page captures")
      .check();
    await panel.getByRole("button", { name: "Save workflow defaults" }).click();
    await expect(
      panel.getByText("Workflow defaults saved on this device."),
    ).toBeVisible();
    await browserContext.close();
    browserContext = undefined;
    console.log(
      "PHASE10_RESTART first Chromium process closed, relaunching the same user-data directory",
    );
    browserContext = await local.launch();
    panel = await openPanel(browserContext, root);
    await expect(
      panel.getByRole("heading", { name: "Working dataset" }),
    ).toHaveCount(0);
    await panel.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(panel.getByLabel("Cleanup age")).toHaveValue("90");
    await expect(panel.getByLabel("Default export format")).toHaveValue("json");
    await expect(panel.getByLabel("Default delay (ms)")).toHaveValue("1750");
    await panel
      .getByRole("button", { name: "Local history", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: "Restore Edited inventory" }),
    ).toBeEnabled();
    await expect(
      panel.getByText(/1 of 20 snapshots · 1 of 50 configurations/),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Use configuration Inventory schema" }),
    ).toBeDisabled();
    await expect(panel.locator("main")).not.toContainText("never-store-this");
    if (process.env.PHASE10_SCREENSHOT) {
      await panel.setViewportSize({ width: 1040, height: 900 });
      await panel.emulateMedia({ colorScheme: "dark" });
      await panel.evaluate(() => document.fonts.ready);
      await panel.screenshot({
        path: process.env.PHASE10_SCREENSHOT,
        fullPage: true,
      });
    }
    const axe = await new AxeBuilder({ page: panel })
      .include(".library-panel")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations.map((p) => p.id)).toEqual([]);
    await panel
      .getByRole("button", { name: "Restore Edited inventory" })
      .click();
    const restored = panel.getByRole("table", { name: "Captured records" });
    await panel.getByText("Export and copy records", { exact: true }).click();
    await expect(panel.getByLabel("File format")).toHaveValue("json");
    await expect(restored).toContainText("Edited local lamp");
    await expect(restored).toContainText("সরঞ্জাম");
    await expect(restored).not.toContainText("Camp pack");
    await expect(
      restored.getByRole("button", { name: /^Edit Item in row 3:/ }),
    ).toBeVisible();
    acceptDialog(panel);
    await panel.getByRole("button", { name: "Discard dataset" }).click();
    source = await openSource(
      browserContext,
      panel,
      `${server.origin}/inventory?different=1`,
    );
    await invoke(panel, "Analyze page");
    await expect(
      panel.getByRole("table", { name: "HTML table preview" }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Local history", exact: true })
      .click();
    await panel
      .getByRole("button", { name: "Use configuration Inventory schema" })
      .click();
    await expect(
      panel.getByRole("heading", {
        name: "Data preview",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: "Working dataset" }),
    ).toHaveCount(0);
    await expect(source).toHaveURL(`${server.origin}/inventory?different=1`);
    await source.bringToFront();
    await invoke(panel, "Inspect pagination controls");
    await expect(panel.getByLabel("Maximum additional actions")).toHaveValue(
      "2",
    );
    await expect(panel.getByLabel("Minimum delay (ms)")).toHaveValue("1750");
    await invoke(panel, "Close pagination");
    await invoke(panel, "Collect records");
    await expect(panel.getByText(/Skipped 1 exact duplicate/)).toBeVisible();
    await expect(
      panel.getByRole("table", { name: "Captured records" }),
    ).toHaveAttribute("aria-rowcount", "4");
    acceptDialog(panel);
    await panel.getByRole("button", { name: "Discard dataset" }).click();
    await panel
      .getByRole("button", { name: "Local history", exact: true })
      .click();
    acceptDialog(panel);
    await panel
      .getByRole("button", { name: "Delete snapshot Edited inventory" })
      .click();
    await expect(panel.getByText("No saved snapshots yet.")).toBeVisible();
    await expect(
      panel.getByText("Inventory schema", { exact: true }),
    ).toBeVisible();
    acceptDialog(panel);
    await panel
      .getByRole("button", { name: "Delete configuration Inventory schema" })
      .click();
    await expect(panel.getByText("No saved configurations yet.")).toBeVisible();
    await panel.reload();
    await panel
      .getByRole("button", { name: "Local history", exact: true })
      .click();
    await expect(
      panel.getByText(
        /0 B of 24 MiB snapshot data · 0 of 20 snapshots · 0 of 50 configurations/,
      ),
    ).toBeVisible();
    const count = await panel.evaluate(async (name) => {
      return new Promise<number>((ok, fail) => {
        const r = indexedDB.open(name, 2);
        r.onerror = () => fail(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("snapshots");
          const read = tx.objectStore("snapshots").count();
          read.onsuccess = () => ok(read.result);
          tx.oncomplete = () => db.close();
        };
      });
    }, libraryName);
    expect(count).toBe(0);
  } finally {
    await browserContext?.close();
    await server.close();
    await local.dispose();
  }
});

test("library migrates legacy snapshots and settings, retains recent records during cleanup, and clears on request", async () => {
  const local = await extensionFixture();
  const context = await local.launch();
  try {
    const worker = await background(context);
    await legacy(worker);
    const root = `chrome-extension://${new URL(worker.url()).host}`;
    const panel = await openPanel(context, root);
    await panel
      .getByRole("button", { name: "Local history", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: "Restore Legacy inventory" }),
    ).toBeEnabled();
    await expect(panel.getByText(/partial capture/)).toBeVisible();
    await panel
      .getByRole("button", { name: "Restore Legacy inventory" })
      .click();
    await expect(
      panel.getByRole("table", { name: "Captured records" }),
    ).toContainText("Legacy বাংলা");
    await expect(panel.getByText(/Partial capture · 1 rows/)).toBeVisible();
    acceptDialog(panel);
    await panel.getByRole("button", { name: "Discard dataset" }).click();
    await panel.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(panel.getByLabel("Cleanup age")).toHaveValue("7");
    const migrated = await worker.evaluate(async (key) => {
      const chrome = (globalThis as unknown as { chrome: typeof BrowserApi })
        .chrome;
      return (await chrome.storage.local.get(key))[key];
    }, storageSettingsKey);
    expect(migrated).toEqual({ ...defaultStorageSettings, cleanupDays: 7 });
    acceptDialog(panel);
    await panel.getByRole("button", { name: "Clean older snapshots" }).click();
    await expect(
      panel.getByText("Removed 1 snapshot older than 7 days."),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Local history", exact: true })
      .click();
    await expect(
      panel.getByText("Legacy inventory", { exact: true }),
    ).toHaveCount(0);
    await expect(
      panel.getByText("Recent inventory", { exact: true }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Settings", exact: true }).click();
    acceptDialog(panel);
    await panel.getByRole("button", { name: "Clear snapshot history" }).click();
    await expect(
      panel.getByText("Local snapshot history cleared."),
    ).toBeVisible();
  } finally {
    await context.close();
    await local.dispose();
  }
});

test("library fails closed on invalid migration data and leaves the original version intact", async () => {
  const local = await extensionFixture();
  const context = await local.launch();
  try {
    const worker = await background(context);
    await legacy(worker, true);
    const root = `chrome-extension://${new URL(worker.url()).host}`;
    const panel = await openPanel(context, root);
    await expect(panel.getByRole("alert")).toContainText(
      "Existing snapshots were not overwritten",
    );
    const old = await worker.evaluate(
      async (name) =>
        new Promise<{ version: number; stores: string[]; count: number }>(
          (ok, fail) => {
            const request = indexedDB.open(name);
            request.onerror = () => fail(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction("sessions");
              const count = tx.objectStore("sessions").count();
              count.onsuccess = () =>
                ok({
                  version: db.version,
                  stores: Array.from(db.objectStoreNames),
                  count: count.result,
                });
              tx.oncomplete = () => db.close();
            };
          },
        ),
      libraryName,
    );
    expect(old).toEqual({ version: 1, stores: ["sessions"], count: 2 });
  } finally {
    await context.close();
    await local.dispose();
  }
});

test("library transaction scale and concurrent capacity checks use the actual Chromium IndexedDB implementation", async ({
  page,
}) => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve("tests/fixtures/library/harness.ts"),
        name: "LibraryHarness",
        formats: ["iife"],
      },
    },
  });
  const chunk = (Array.isArray(result) ? result : [result])
    .flatMap((o) => ("output" in o ? o.output : []))
    .find((o) => o.type === "chunk");
  if (!chunk || chunk.type !== "chunk")
    throw new Error("Missing library harness");
  const route = "https://local-library-fixture.test/";
  await page.route(route, (r) =>
    r.fulfill({
      body: "<title>IndexedDB fixture</title>",
      contentType: "text/html",
    }),
  );
  await page.goto(route);
  await page.addScriptTag({ content: chunk.code });
  for (const size of [100, 1000, 10000]) {
    const metrics = await page.evaluate(async (size) => {
      const library = window.scrapnexLibrary(indexedDB, `scale-${size}`);
      const data: Dataset = {
        version: 1,
        columns: [
          { id: "c1", label: "Item", kind: "text" },
          { id: "c2", label: "Note", kind: "text" },
        ],
        rows: Array.from({ length: size }, (_, i) => ({
          id: `r${i + 1}`,
          cells: [`Record ${i + 1}`, "বাংলা"],
        })),
      };
      const start = performance.now();
      const saved = await library.save("Scale test", data, false);
      const saveMs = performance.now() - start;
      const readStart = performance.now();
      const restored = await library.restore(saved.id);
      const restoreMs = performance.now() - readStart;
      return {
        size: restored.dataset.rows.length,
        last: restored.dataset.rows.at(-1)?.cells[0],
        bytes: saved.byteCount,
        saveMs,
        restoreMs,
      };
    }, size);
    expect(metrics).toMatchObject({ size, last: `Record ${size}` });
    console.log(
      `PHASE10_SCALE rows=${size} bytes=${metrics.bytes} save_ms=${metrics.saveMs.toFixed(1)} restore_ms=${metrics.restoreMs.toFixed(1)}`,
    );
  }
  const cap = await page.evaluate(async (dataset) => {
    const library = window.scrapnexLibrary(indexedDB, "capacity");
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) =>
        library.save(`Snapshot ${i}`, dataset, false),
      ),
    );
    const entries = await library.readLibrary();
    return {
      saved: results.filter((r) => r.status === "fulfilled").length,
      limited: results.filter(
        (r) => r.status === "rejected" && String(r.reason).includes("capacity"),
      ).length,
      listed: entries.sessions.length,
    };
  }, small);
  expect(cap).toEqual({ saved: 20, limited: 5, listed: 20 });
});

test("advanced portable configuration and redacted diagnostics use real local downloads", async () => {
  const local = await extensionFixture(true),
    server = await fixtureServer();
  const context = await local.launch();
  try {
    const worker = await background(context);
    const panel = await openPanel(
      context,
      `chrome-extension://${new URL(worker.url()).host}`,
    );
    const source = await openSource(
      context,
      panel,
      `${server.origin}/inventory?private=do-not-share`,
    );
    await invoke(panel, "Analyze page");
    await panel.getByText("Extraction diagnostics", { exact: true }).click();
    const [diagnostics] = await Promise.all([
      panel.waitForEvent("download"),
      panel.getByRole("button", { name: "Download diagnostics" }).click(),
    ]);
    const raw = await readFile(await diagnostics.path(), "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      status: "complete",
      candidateCount: 1,
      candidates: [{ kind: "table", observed: 3, columns: 2 }],
    });
    expect(raw).not.toMatch(/do-not-share|127\.0\.0\.1|Field lamp|Quantity/);
    await panel
      .getByText("Save extraction configuration", { exact: true })
      .click();
    await panel.getByLabel("Configuration name").fill("Portable example");
    await invoke(panel, "Save configuration");
    await expect(
      panel.getByText("Saved configuration “Portable example”."),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Local history", exact: true })
      .click();
    const [config] = await Promise.all([
      panel.waitForEvent("download"),
      panel
        .getByRole("button", {
          name: "Download configuration Portable example",
        })
        .click(),
    ]);
    const data = await readFile(await config.path());
    expect(data.toString("utf8")).not.toMatch(
      /do-not-share|Field lamp|savedAt/,
    );
    acceptDialog(panel);
    await invoke(panel, "Delete configuration Portable example");
    await expect(panel.getByText("No saved configurations yet.")).toBeVisible();
    await panel.getByText("Import configuration", { exact: true }).click();
    const input = panel.getByLabel("Configuration JSON file");
    await input.setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":9}'),
    });
    await expect(panel.getByRole("alert")).toContainText(
      "Unsupported configuration file format or version",
    );
    await input.setInputFiles({
      name: "portable.json",
      mimeType: "application/json",
      buffer: data,
    });
    await expect(panel.getByText(/Review “Portable example”/)).toBeVisible();
    await expect(panel.getByText("No saved configurations yet.")).toBeVisible();
    await invoke(panel, "Confirm configuration import");
    await expect(
      panel.getByText("Imported configuration “Portable example”."),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", {
        name: "Download configuration Portable example",
      }),
    ).toBeEnabled();
    await expect(
      panel.getByRole("heading", { name: "Working dataset" }),
    ).toHaveCount(0);
    await expect(source).toHaveURL(
      `${server.origin}/inventory?private=do-not-share`,
    );
  } finally {
    await context.close();
    await server.close();
    await local.dispose();
  }
});

test("advanced URL queue only opens on explicit action and tracks accepted exact-page captures", async () => {
  const local = await extensionFixture(true),
    server = await fixtureServer();
  const context = await local.launch();
  try {
    const worker = await background(context);
    const panel = await openPanel(
      context,
      `chrome-extension://${new URL(worker.url()).host}`,
    );
    const url = `${server.origin}/inventory?queued=1`;
    const next = `${server.origin}/inventory?queued=2`;
    await panel.getByText("Multi-URL queue", { exact: true }).click();
    await panel
      .getByLabel("One absolute HTTP(S) URL per line")
      .fill(`${url}\n${next}`);
    await invoke(panel, "Prepare URL queue");
    await expect(panel.getByText("Waiting", { exact: true })).toHaveCount(2);
    expect(
      context.pages().some((tab) => tab.url().startsWith(server.origin)),
    ).toBe(false);
    const [first] = await Promise.all([
      context.waitForEvent("page"),
      invoke(panel, "Open next queued page"),
    ]);
    await expect(first).toHaveURL(url);
    await expect(
      panel.getByText("Opened · waiting for capture", { exact: true }),
    ).toBeVisible();
    await expect(panel.getByRole("table")).toHaveCount(0);
    await first.goto(`${server.origin}/inventory?different=1`);
    await first.bringToFront();
    await invoke(panel, "Analyze page");
    await expect(
      panel.getByRole("table", { name: "HTML table preview" }),
    ).toBeVisible();
    await invoke(panel, "Collect records");
    await expect(
      panel.getByRole("heading", { name: "Working dataset" }),
    ).toBeVisible();
    await expect(
      panel.getByText("Opened · waiting for capture", { exact: true }),
    ).toBeVisible();
    acceptDialog(panel);
    await panel.getByRole("button", { name: "Discard dataset" }).click();
    await first.goto(url);
    await first.bringToFront();
    await invoke(panel, "Analyze page");
    await expect(
      panel.getByRole("table", { name: "HTML table preview" }),
    ).toBeVisible();
    await invoke(panel, "Collect records");
    await expect(panel.getByText("Collected", { exact: true })).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Open next queued page" }),
    ).toBeDisabled();
    expect(context.pages().some((tab) => tab.url() === next)).toBe(false);
    acceptDialog(panel);
    await panel.getByRole("button", { name: "Discard dataset" }).click();
    const [second] = await Promise.all([
      context.waitForEvent("page"),
      invoke(panel, "Open next queued page"),
    ]);
    await expect(second).toHaveURL(next);
    await invoke(panel, "Skip queued page");
    await expect(panel.getByText("Skipped", { exact: true })).toBeVisible();
  } finally {
    await context.close();
    await server.close();
    await local.dispose();
  }
});
