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
} from "@playwright/test";
import type { browser as BrowserApi } from "wxt/browser";

/**
 * Phase D gates for the data surfaces: G7 and G13 measured with real records on
 * screen (an empty panel proves nothing about a grid), plus the phase's own exit
 * criterion — 10 000 rows must still paint at 50 fps.
 *
 * The build under test is a copy with a loopback-only host grant, the same
 * convention as `design.spec.ts`. The shipped manifest is asserted clean
 * elsewhere.
 */

const build = resolve(".output/chrome-mv3");
let scratch: string;
let context: BrowserContext;
let server: Server;
let origin: string;
let panel: Page;

test.beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "scrapnex-data-"));
  const copy = join(scratch, "extension");
  await cp(build, copy, { recursive: true });
  const manifestPath = join(copy, "manifest.json");
  const manifest: object = JSON.parse(await readFile(manifestPath, "utf8"));
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, host_permissions: ["http://127.0.0.1/*"] }),
  );
  server = createServer((request, response) => {
    const scale = request.url?.match(/^\/records\/(\d+)$/)?.[1];
    if (!scale) {
      response.writeHead(404).end();
      return;
    }
    const rows = Array.from(
      { length: Number(scale) },
      (_, index) =>
        `<tr><td>Record ${index + 1}</td><td>${index + 1}</td><td>${(index % 7) + 1}</td></tr>`,
    ).join("");
    response
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(
        `<!doctype html><html lang="en"><title>Scale fixture</title><main>` +
          `<table><thead><tr><th>Record</th><th>Quantity</th><th>Batch</th></tr></thead>` +
          `<tbody>${rows}</tbody></table></main></html>`,
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
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
  panel = await context.newPage();
  await panel.setViewportSize({ width: 1120, height: 950 });
  await panel.goto(
    `chrome-extension://${new URL(worker.url()).host}/sidepanel.html`,
  );
});

test.afterAll(async () => {
  if (context) await context.close();
  if (server) await new Promise<void>((done) => server.close(() => done()));
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

/** Open the scale fixture and capture it, returning the source tab. */
async function capture(scale: number): Promise<Page> {
  const source = await context.newPage();
  await source.goto(`${origin}/records/${scale}`);
  await panel.reload();
  await source.bringToFront();
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
      }, source.url()),
    )
    .toBe(true);
  const click = (name: string) =>
    panel
      .getByRole("button", { name, exact: true })
      .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(
    panel.getByRole("button", { name: "Analyze page", exact: true }),
  ).toBeEnabled();
  await click("Analyze page");
  await expect(
    panel.getByRole("button", { name: "Collect records", exact: true }),
  ).toBeVisible();
  await click("Collect records");
  await expect(
    panel.getByRole("table", { name: "Captured records" }),
  ).toHaveAttribute("aria-rowcount", String(scale + 1), { timeout: 20_000 });
  return source;
}

test("G13: the populated grid is axe-clean and every control keeps its floor", async () => {
  test.setTimeout(90_000);
  const source = await capture(200);
  try {
    const results = await new AxeBuilder({ page: panel })
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

    const sizes = await panel.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".dataset-panel button, .dataset-panel input, .dataset-panel select",
        ),
      )
        .filter((node) => node.offsetParent !== null)
        .map((node) => {
          // A checkbox wrapped in its label is clicked through the label, so the
          // label is the target that has to meet the floor.
          const target =
            node instanceof HTMLInputElement
              ? (node.closest("label") ?? node)
              : node;
          const box = target.getBoundingClientRect();
          return {
            name:
              node.getAttribute("aria-label") ??
              node.textContent?.trim().slice(0, 30) ??
              node.tagName,
            height: Math.round(box.height),
          };
        })
        .filter((item) => item.height < 28),
    );
    expect(sizes, JSON.stringify(sizes)).toEqual([]);
  } finally {
    await source.close();
  }
});

test("tabular figures are used in the grid and the price column", async () => {
  test.setTimeout(90_000);
  const source = await capture(50);
  try {
    const figures = await panel.evaluate(() => {
      const cell = document.querySelector<HTMLElement>(
        ".dataset-grid .grid-cell",
      );
      return cell ? getComputedStyle(cell).fontVariantNumeric : "missing-cell";
    });
    expect(figures).toBe("tabular-nums");
  } finally {
    await source.close();
  }
});

test("the grid header stays pinned while the rows scroll under it", async () => {
  test.setTimeout(90_000);
  const source = await capture(1000);
  try {
    const offset = await panel.evaluate(async () => {
      const grid = document.querySelector<HTMLElement>(".dataset-grid");
      const head = grid?.querySelector<HTMLElement>("thead");
      if (!grid || !head) return null;
      const before = Math.round(
        head.getBoundingClientRect().top - grid.getBoundingClientRect().top,
      );
      grid.scrollTop = 2000;
      await new Promise((done) => requestAnimationFrame(done));
      const after = Math.round(
        head.getBoundingClientRect().top - grid.getBoundingClientRect().top,
      );
      return { before, after, scrolled: grid.scrollTop };
    });
    expect(offset).not.toBeNull();
    expect(offset!.scrolled).toBeGreaterThan(0);
    expect(Math.abs(offset!.after - offset!.before)).toBeLessThanOrEqual(1);
  } finally {
    await source.close();
  }
});

test("selection is visibly different from an unselected row", async () => {
  test.setTimeout(90_000);
  const source = await capture(100);
  try {
    const table = panel.getByRole("table", { name: "Captured records" });
    const before = await table
      .locator("tbody tr[aria-rowindex]")
      .first()
      .evaluate((row) => getComputedStyle(row).backgroundColor);
    await table.getByRole("checkbox").first().check();
    const after = await table
      .locator("tbody tr[aria-rowindex]")
      .first()
      .evaluate((row) => getComputedStyle(row).backgroundColor);
    expect(after).not.toBe(before);
  } finally {
    await source.close();
  }
});

test("10 000 rows still scroll at 50 fps", async () => {
  test.setTimeout(120_000);
  const source = await capture(10_000);
  try {
    // rAF is throttled to ~1 Hz in a background tab; bring the panel forward so
    // the measured cadence is the real one.
    await panel.bringToFront();
    const run = await panel.evaluate(async () => {
      const grid = document.querySelector<HTMLElement>(".dataset-grid");
      if (!grid) throw new Error("grid missing");
      const frame = () =>
        new Promise<number>((done) => requestAnimationFrame(done));
      const gaps: number[] = [];
      let previous = await frame();
      let frames = 0;
      const start = previous;
      // One second of continuous scrolling: the count of painted frames in a
      // fixed wall-clock window is the frame rate, and it is not distorted by
      // rAF quantisation the way an average delta is.
      while (previous - start < 1000) {
        grid.scrollTop += 90;
        const current = await frame();
        gaps.push(current - previous);
        previous = current;
        frames += 1;
      }
      const seconds = (previous - start) / 1000;
      gaps.sort((left, right) => left - right);
      return {
        fps: frames / seconds,
        p95: gaps[Math.floor(gaps.length * 0.95)] ?? 0,
        max: gaps.at(-1) ?? 0,
        rows: document.querySelectorAll(".dataset-grid tbody tr[aria-rowindex]")
          .length,
      };
    });
    console.log(
      `PHASE_D_GRID rows=${run.rows} dom_rows=${run.rows} fps=${run.fps.toFixed(0)} ` +
        `p95=${run.p95.toFixed(1)}ms max=${run.max.toFixed(1)}ms`,
    );
    expect(run.rows).toBeLessThanOrEqual(30);
    expect(run.fps).toBeGreaterThanOrEqual(50);
  } finally {
    await source.close();
  }
});
