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
import { corpus, decoys, type CorpusPage } from "../fixtures/corpus/pages";

const build = resolve(".output/chrome-mv3");
const report = resolve("docs/reports/ACCURACY.md");
/** Regression floor: raise it when accuracy improves, never lower it to pass. */
const baselineFloor = 95;

let scratch: string;
let context: BrowserContext;
let server: Server;
let origin: string;
let panel: Page;

const pages = new Map(corpus.map((page) => [`/corpus/${page.id}`, page]));

test.beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "scrapnex-corpus-"));
  const copy = join(scratch, "extension");
  await cp(build, copy, { recursive: true });
  const manifestPath = join(copy, "manifest.json");
  const manifest: object = JSON.parse(await readFile(manifestPath, "utf8"));
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, host_permissions: ["http://127.0.0.1/*"] }),
  );
  server = createServer((request, response) => {
    const page = pages.get(request.url ?? "");
    if (!page) {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(page.html);
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Corpus server has no port");
  origin = `http://127.0.0.1:${address.port}`;
  context = await chromium.launchPersistentContext(join(scratch, "profile"), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`],
  });
  const worker =
    context
      .serviceWorkers()
      .find((candidate) => candidate.url().endsWith("/background.js")) ??
    (await context.waitForEvent("serviceworker", {
      predicate: (candidate) => candidate.url().endsWith("/background.js"),
      timeout: 10_000,
    }));
  panel = await context.newPage();
  await panel.goto(
    `chrome-extension://${new URL(worker.url()).host}/sidepanel.html`,
  );
});

test.afterAll(async () => {
  if (context) await context.close();
  if (server) await new Promise<void>((done) => server.close(() => done()));
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

async function detect(url: string): Promise<PageDetection> {
  const page = await context.newPage();
  try {
    await page.goto(url);
    const result = await panel.evaluate(async (target) => {
      const { chrome } = window as unknown as { chrome: typeof BrowserApi };
      const tab = (await chrome.tabs.query({ url: target })).find(
        (item) => item.url === target,
      );
      if (tab?.id === undefined) throw new Error("Corpus tab missing");
      const [response] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        files: ["/page-agent.js"],
      });
      if (response?.frameId !== 0) throw new Error("Wrong frame");
      return response.result as unknown;
    }, url);
    if (!isPageDetection(result))
      throw new Error(`Unexpected agent result for ${url}`);
    return result;
  } finally {
    await page.close();
  }
}

interface Outcome {
  page: CorpusPage;
  status: PageDetection["status"] | "error";
  top: {
    kind: string;
    rows: number;
    estimate: number;
    sampled: boolean;
    columns: number;
  } | null;
  verdict:
    "pass" | "kind-miss" | "shape-miss" | "bleed" | "no-candidate" | "error";
  decoy: boolean;
  detail: string;
}

function evaluate(page: CorpusPage, detection: PageDetection): Outcome {
  const top = detection.candidates[0];
  if (!top)
    return {
      page,
      status: detection.status,
      top: null,
      verdict: "no-candidate",
      decoy: false,
      detail: "No candidate offered",
    };
  // Sampled candidates report a bounded observed count plus a full estimate;
  // compare the band against whichever number represents the whole structure.
  const summary = {
    kind: top.kind,
    rows: top.sampled ? Math.max(top.observed, top.estimate) : top.observed,
    estimate: top.estimate,
    sampled: top.sampled,
    columns: top.columns.length,
  };
  const rowText = top.rows
    .flat()
    .filter((cell): cell is string => typeof cell === "string")
    .join(" ");
  const decoy = decoys.some((phrase) =>
    rowText.toLowerCase().includes(phrase.toLowerCase()),
  );
  const kindOk = page.expect.kinds.includes(top.kind as never);
  const rowsOk =
    summary.rows >= page.expect.minRows && summary.rows <= page.expect.maxRows;
  const columnsOk =
    summary.columns >= page.expect.minColumns &&
    summary.columns <= page.expect.maxColumns;
  const absent = page.expect.absentFromTop ?? [];
  const bleed = absent.filter((needle) =>
    rowText.toLowerCase().includes(needle.toLowerCase()),
  );
  const verdict = !kindOk
    ? "kind-miss"
    : !rowsOk || !columnsOk
      ? "shape-miss"
      : bleed.length
        ? "bleed"
        : "pass";
  const detail = [
    kindOk ? "" : `kind ${summary.kind} ∉ ${page.expect.kinds.join("|")}`,
    rowsOk
      ? ""
      : `rows ${summary.rows} ∉ ${page.expect.minRows}–${page.expect.maxRows}`,
    columnsOk
      ? ""
      : `columns ${summary.columns} ∉ ${page.expect.minColumns}–${page.expect.maxColumns}`,
    bleed.length ? `inner content leaked: ${bleed.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  return {
    page,
    status: detection.status,
    top: summary,
    verdict: verdict as Outcome["verdict"],
    decoy,
    detail: detail || "Expected structure ranked first",
  };
}

function toMarkdown(outcomes: Outcome[], durationMs: number): string {
  const pass = outcomes.filter((item) => item.verdict === "pass").length;
  const decoys = outcomes.filter((item) => item.decoy).length;
  const wrong = outcomes.filter((item) => item.verdict === "kind-miss").length;
  const shape = outcomes.filter((item) => item.verdict === "shape-miss").length;
  const none = outcomes.filter(
    (item) => item.verdict === "no-candidate" || item.verdict === "error",
  ).length;
  const rate = ((pass / outcomes.length) * 100).toFixed(1);
  const byArchetype = new Map<string, { pass: number; total: number }>();
  for (const item of outcomes) {
    const bucket = byArchetype.get(item.page.archetype) ?? {
      pass: 0,
      total: 0,
    };
    bucket.total++;
    if (item.verdict === "pass") bucket.pass++;
    byArchetype.set(item.page.archetype, bucket);
  }
  const rows = outcomes
    .map(
      (item) =>
        `| \`${item.page.id}\` | ${item.page.archetype} | ${item.page.note} | \`${item.top?.kind ?? "—"}\` | ${item.top?.rows ?? "—"}${item.top?.sampled ? "*" : ""} / ${item.top?.columns ?? "—"} | ${item.verdict === "pass" ? "PASS" : `FAIL (${item.verdict})`} | ${item.decoy ? "yes" : "no"} |`,
    )
    .join("\n");
  const archetypeRows = [...byArchetype.entries()]
    .map(
      ([archetype, bucket]) =>
        `| ${archetype} | ${bucket.pass}/${bucket.total} | ${((bucket.pass / bucket.total) * 100).toFixed(0)} % |`,
    )
    .join("\n");
  return `# Detection accuracy report

Generated by \`tests/e2e/corpus.spec.ts\`. Do not edit by hand.

- Run: ${new Date().toISOString()}
- Corpus: **${outcomes.length} pages** (deterministic offline fixtures)
- Engine: packaged \`page-agent.js\` in Chromium, isolated world, top frame
- Wall time: ${(durationMs / 1000).toFixed(1)} s

> **Interpretation limit.** These fixtures are built by us, so the pass rate measures
> regression safety, not real-world accuracy. A launch claim requires captured pages from
> sites the operator is authorized to analyze; add them with the procedure below and
> report the two numbers separately.

## Summary

| Metric | Value |
| --- | --- |
| Top-1 accuracy | **${pass}/${outcomes.length} (${rate} %)** |
| Wrong structure ranked first | ${wrong} |
| Right structure, wrong shape | ${shape} |
| No candidate / error | ${none} |
| Decoy content leaked into top-1 | ${decoys} |

## By archetype

| Archetype | Pass | Rate |
| --- | --- | --- |
${archetypeRows}

Rows marked \`*\` were sampled (the table exceeded the 32-row scan bound); the band is
checked against the reported estimate for the whole structure.

## By page

| Page | Archetype | Note | Top kind | Rows / cols | Verdict | Decoy leak |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## How to add a real page

1. Open the page in a normal Chrome window **you are authorized to analyze**.
2. Save it with DevTools → Sources → "Save all as HAR"? No — use
   \`Copy outerHTML\` of \`document.documentElement\` and paste into a fixture file.
3. Add an entry to \`tests/fixtures/corpus/pages.ts\` with the expected kind and shape band.
4. Re-run \`npm run test:e2e -- tests/e2e/corpus.spec.ts\` and review the diff in this report.

Never fetch a live site from the test run: the corpus must stay offline and deterministic.
`;
}

test("measures top-1 detection accuracy across the committed corpus", async () => {
  test.setTimeout(240_000);
  expect(corpus.length).toBeGreaterThanOrEqual(40);
  const started = Date.now();
  const outcomes: Outcome[] = [];
  for (const page of corpus) {
    try {
      outcomes.push(
        evaluate(page, await detect(`${origin}/corpus/${page.id}`)),
      );
    } catch (error) {
      outcomes.push({
        page,
        status: "error",
        top: null,
        verdict: "error",
        decoy: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const markdown = toMarkdown(outcomes, Date.now() - started);
  await writeFile(report, markdown);
  const pass = outcomes.filter((item) => item.verdict === "pass").length;
  const rate = (pass / outcomes.length) * 100;
  // Harness integrity: every page must produce a complete scan.
  expect(outcomes.every((item) => item.status === "complete")).toBe(true);
  // Accuracy regression floor (raise as accuracy improves).
  expect(rate).toBeGreaterThanOrEqual(baselineFloor);
  console.log(
    `CORPUS_ACCURACY pages=${outcomes.length} pass=${pass} rate=${rate.toFixed(1)}% ` +
      `kind_miss=${outcomes.filter((item) => item.verdict === "kind-miss").length} ` +
      `shape_miss=${outcomes.filter((item) => item.verdict === "shape-miss").length} ` +
      `decoy=${outcomes.filter((item) => item.decoy).length}`,
  );
  for (const item of outcomes.filter((entry) => entry.verdict !== "pass"))
    console.log(
      `CORPUS_FAIL ${item.page.id} ${item.verdict} :: ${item.detail}`,
    );
});
