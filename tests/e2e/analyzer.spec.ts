import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { build } from "vite";
import type {} from "../fixtures/analyzer/harness";
import type { AnalysisResult } from "../../src/core/analyzer";

let harness = "";

test.beforeAll(async () => {
  const out = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve("tests/fixtures/analyzer/harness.ts"),
        name: "AnalyzerHarness",
        formats: ["iife"],
      },
    },
  });
  const outputs = Array.isArray(out) ? out : [out];
  const chunk = outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .find((asset) => asset.type === "chunk");
  if (!chunk || chunk.type !== "chunk")
    throw new Error("The test-only analyzer harness did not compile.");
  harness = chunk.code;
});

async function load(page: Page, name?: string) {
  await page.setContent(
    name
      ? await readFile(resolve(`tests/fixtures/analyzer/${name}.html`), "utf8")
      : "<main></main>",
  );
  await page.addScriptTag({ content: harness });
}

function stable(result: AnalysisResult) {
  return {
    status: result.status,
    reason: result.reason,
    candidates: result.candidates,
    visited: result.stats.visited,
  };
}

test("nested meaningful content outranks navigation and retains deterministic explanations", async ({
  page,
}) => {
  await load(page, "nested");
  const first = await page.evaluate(() => window.scrapnexAnalyze(document));
  expect(first.status).toBe("complete");
  expect(first.candidates[0]).toMatchObject({
    kind: "repeated-siblings",
    tag: "article",
    observedRows: 3,
    confidence: "strong",
  });
  expect(first.candidates[0]?.reasons.map(({ code }) => code)).toEqual(
    expect.arrayContaining(["repeat", "similarity", "aligned-signals"]),
  );
  expect(
    first.candidates.some(
      (candidate) => candidate.observedRows === 2 && candidate.tag === "li",
    ),
  ).toBe(true);
  const nav = first.candidates.find((candidate) =>
    candidate.reasons.some(({ code }) => code === "landmark"),
  );
  expect(nav?.observedRows).toBe(5);
  expect(nav?.score).toBeLessThan(first.candidates[0]?.score ?? 0);
  expect(
    stable(await page.evaluate(() => window.scrapnexAnalyze(document))),
  ).toEqual(stable(first));
});

test("groups irregular cards, ignores unstable classes, and rediscovers updated rows on a fresh scan", async ({
  page,
}) => {
  await load(page, "irregular");
  const first = await page.evaluate(() => window.scrapnexAnalyze(document));
  expect(first.candidates[0]).toMatchObject({
    tag: "article",
    observedRows: 3,
  });
  await page.evaluate(() =>
    document
      .querySelectorAll("article:not([hidden])")
      .forEach((element, index) => {
        element.className = `renamed-${index}`;
      }),
  );
  expect(
    stable(await page.evaluate(() => window.scrapnexAnalyze(document))),
  ).toEqual(stable(first));
  await page.evaluate(() => {
    const firstRow = document.querySelector("article");
    if (firstRow) firstRow.after(firstRow.cloneNode(true));
  });
  const updated = await page.evaluate(() => window.scrapnexAnalyze(document));
  expect(updated.candidates[0]?.observedRows).toBe(4);
});

test("uses rendered visibility signals, excludes sensitive subtrees, and returns no source text", async ({
  page,
}) => {
  await load(page, "visibility");
  const result = await page.evaluate(() => window.scrapnexAnalyze(document));
  expect(result.status).toBe("complete");
  const articles = result.candidates.filter(
    (candidate) => candidate.tag === "article",
  );
  expect(articles).toHaveLength(2);
  expect(articles.every((candidate) => candidate.observedRows === 2)).toBe(
    true,
  );
  expect(result.stats.pruned).toBeGreaterThanOrEqual(7);
  expect(JSON.stringify(result)).not.toMatch(
    /private-sentinel|Public one|Override visible|Frame text|Shadow 1/,
  );
});

test("cancellation and mid-scan mutation discard stale conclusions", async ({
  page,
}) => {
  await load(page, "nested");
  const result = await page.evaluate(async () => {
    const already = new AbortController();
    already.abort();
    const first = await window.scrapnexAnalyze(document, {
      signal: already.signal,
    });
    const running = new AbortController();
    const second = await window.scrapnexAnalyze(document, {
      signal: running.signal,
      limits: { yieldEvery: 4 },
      schedule: async () => {
        running.abort();
      },
    });
    const third = await window.scrapnexAnalyze(document, {
      limits: { yieldEvery: 4 },
      schedule: async () => {
        document
          .querySelector("main")
          ?.append(document.createElement("article"));
      },
    });
    return { first, second, third };
  });
  expect(result.first).toMatchObject({
    status: "cancelled",
    reason: "aborted",
    candidates: [],
    stats: { visited: 0 },
  });
  expect(result.second).toMatchObject({
    status: "cancelled",
    reason: "aborted",
    candidates: [],
    stats: { visited: 4 },
  });
  expect(result.third).toMatchObject({
    status: "partial",
    reason: "dom-changed",
    candidates: [],
  });
});

test("enforces node, depth, time, sibling sample, and result caps", async ({
  page,
}) => {
  await load(page);
  const result = await page.evaluate(async () => {
    const main = document.querySelector("main");
    if (main)
      main.innerHTML =
        "<nav><ul><li>Menu A</li><li>Menu B</li></ul></nav><section>" +
        "<article><h2>Sample item</h2></article>".repeat(120) +
        "</section>";
    const small = await window.scrapnexAnalyze(document, {
      limits: { maxNodes: 30 },
    });
    const shallow = await window.scrapnexAnalyze(document, {
      limits: { maxDepth: 2 },
    });
    const timed = await window.scrapnexAnalyze(document, {
      limits: { maxTimeMs: 12, yieldEvery: 1 },
      schedule: () => new Promise((resolve) => setTimeout(resolve, 25)),
    });
    const sampled = await window.scrapnexAnalyze(document, {
      limits: { maxSiblings: 10, maxCandidates: 1 },
    });
    return { small, shallow, timed, sampled };
  });
  expect(result.small).toMatchObject({
    status: "partial",
    reason: "node-limit",
    stats: { visited: 30 },
  });
  expect(result.shallow).toMatchObject({
    status: "partial",
    reason: "depth-limit",
  });
  expect(result.timed).toMatchObject({
    status: "partial",
    reason: "time-limit",
  });
  expect(result.sampled.candidates).toHaveLength(1);
  expect(result.sampled.stats.rankedGroups).toBeGreaterThan(1);
  expect(result.sampled.candidates[0]).toMatchObject({
    tag: "article",
    observedRows: 10,
    estimatedRows: 120,
    sampled: true,
  });
});

test("records Chromium timing baselines for flat 100, 1,000 and 10,000 row DOMs", async ({
  page,
}) => {
  await load(page);
  for (const records of [100, 1_000, 10_000]) {
    const result = await page.evaluate(async (records) => {
      const main = document.querySelector("main");
      if (main)
        main.innerHTML = "<article><h2>Fixture record</h2></article>".repeat(
          records,
        );
      const runs = [];
      for (let index = 0; index < 4; index++)
        runs.push(await window.scrapnexAnalyze(document));
      return runs.map((run) => ({
        status: run.status,
        reason: run.reason,
        visited: run.stats.visited,
        result: run.candidates[0],
        ms: Number(run.stats.elapsedMs.toFixed(1)),
      }));
    }, records);
    for (const run of result) {
      expect(run, `${records} record fixture`).toMatchObject({
        status: "complete",
        visited: 2 + records * 3,
        result: { tag: "article", estimatedRows: records },
      });
    }
    const times = result.map(({ ms }) => ms);
    const warm = times.slice(1).sort((a, b) => a - b);
    console.log(
      `BASELINE rows=${records} nodes=${result[0]?.visited} first_ms=${times[0]} warm_ms=${times.slice(1).join(",")} warm_median_ms=${warm[1]}`,
    );
  }
});

test("collection discards all records on an in-flight DOM change or abort and enforces row and field-data caps", async ({
  page,
}) => {
  await load(page);
  const result = await page.evaluate(async () => {
    const columns = [{ id: "c1", label: "Note", kind: "text" as const }];
    const change = await window.scrapnexCollect(
      document,
      {
        columns,
        rows: (function* () {
          yield ["first"];
          document.querySelector("main")!.textContent =
            "Changed during capture";
          yield ["next"];
        })(),
      },
      location.href,
    );
    const controller = new AbortController();
    const aborted = await window.scrapnexCollect(
      document,
      {
        columns,
        rows: (function* () {
          yield ["first"];
          controller.abort();
          yield ["next"];
        })(),
      },
      location.href,
      false,
      controller.signal,
    );
    const capped = await window.scrapnexCollect(
      document,
      {
        columns,
        rows: (function* () {
          for (let i = 0; i < 4000; i++) yield ["x".repeat(640)];
        })(),
      },
      location.href,
    );
    const rowCapped = await window.scrapnexCollect(
      document,
      {
        columns,
        rows: (function* () {
          for (let i = 0; i < 10_001; i++) yield [String(i)];
        })(),
      },
      location.href,
    );
    return {
      change,
      aborted,
      rowStatus: rowCapped.status,
      rowCap: "dataset" in rowCapped ? rowCapped.dataset.rows.length : 0,
      capStatus: capped.status,
      capRows: "dataset" in capped ? capped.dataset.rows.length : 0,
    };
  });
  expect(result.change).toMatchObject({ status: "changed" });
  expect(result.change).not.toHaveProperty("dataset");
  expect(result.aborted).toMatchObject({ status: "changed" });
  expect(result.aborted).not.toHaveProperty("dataset");
  expect(result).toMatchObject({
    capStatus: "partial",
    capRows: 3125,
    rowStatus: "partial",
    rowCap: 10000,
  });
});
