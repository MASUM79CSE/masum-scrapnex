import { describe, expect, it } from "vitest";
import {
  canonicalOrigin,
  cleanedName,
  defaultStorageSettings,
  isStoredDataset,
  matchRecipe,
  newRecipe,
  parseStorageSettings,
  plainSnapshot,
  snapshotSummary,
} from "../../src/core/library/contracts";
import type { Dataset } from "../../src/core/extraction/contracts";
import type {
  DetectedCandidate,
  PageDetection,
} from "../../src/core/detector/contracts";
const fixture: Dataset = {
  version: 1,
  columns: [
    { id: "t1", label: "Item", kind: "text" },
    { id: "t2", label: "URL", kind: "url" },
  ],
  rows: [
    { id: "r1", cells: ["সরঞ্জাম", ""] },
    { id: "r3", cells: ["", "https://example.test/file"] },
    { id: "r8", cells: [null, null] },
  ],
};
const candidate: DetectedCandidate = {
  id: "table-1",
  kind: "table",
  observed: 3,
  estimate: 3,
  sampled: false,
  score: 95,
  explanations: [],
  columns: fixture.columns,
  rows: fixture.rows.map((r) => r.cells),
};
const report: PageDetection = {
  version: 1,
  status: "complete",
  candidates: [candidate],
  notes: [],
};

describe("local library schema and settings", () => {
  it("preserves edited row IDs, blank and missing cells; omits extraneous properties", () => {
    const snapshot = plainSnapshot({
      ...fixture,
      rawSiteUrl: "https://private.example/?token=secret",
    } as Dataset);
    expect(snapshot).toEqual(fixture);
    expect(snapshot.rows[1]?.id).toBe("r3");
    expect(snapshot.rows[0]?.cells[1]).toBe("");
    expect(snapshot.rows[2]?.cells[1]).toBeNull();
    const summary = snapshotSummary(
      "test-id",
      "  গুরুত্বপূর্ণ  ",
      1,
      true,
      snapshot,
    );
    expect(summary).toEqual({
      id: "test-id",
      name: "গুরুত্বপূর্ণ",
      savedAt: 1,
      partial: true,
      rows: 3,
      columns: 2,
      byteCount: new TextEncoder().encode(JSON.stringify(snapshot)).length,
    });
  });
  it("rejects unsafe cells, duplicate IDs, unknown versions, malformed arrays and oversized snapshots", () => {
    for (const invalid of [
      { ...fixture, version: 3 },
      { ...fixture, columns: new Array(2) },
      { ...fixture, rows: [fixture.rows[0], fixture.rows[0]] },
      {
        ...fixture,
        rows: [{ id: "r1", cells: ["ok", "javascript:alert(1)"] }],
      },
      { ...fixture, rows: [{ id: "r1", cells: ["ok"] }] },
      {
        ...fixture,
        rows: Array.from({ length: 10001 }, () => fixture.rows[0]),
      },
    ])
      expect(isStoredDataset(invalid)).toBe(false);
    expect(() =>
      snapshotSummary("test", "name", 1, false, { ...fixture, rows: [] }),
    ).toThrow(/cannot be saved/);
  });
  it("retains only canonical origin and schema, never sampled rows or route query", () => {
    const recipe = newRecipe(
      "Stock",
      "https://example.test/details?private=1",
      candidate,
      "recipe-one",
      1,
    );
    expect(recipe.origin).toBe("https://example.test");
    expect(JSON.stringify(recipe)).not.toMatch(/private|সরঞ্জাম|\/file/);
    expect(canonicalOrigin("https://user:pass@example.test")).toBeNull();
    expect(canonicalOrigin("file:///hello")).toBeNull();
    expect(matchRecipe(recipe, "https://example.test", report)).toBe(candidate);
    expect(
      matchRecipe(recipe, "https://elsewhere.test", report),
    ).toBeUndefined();
    expect(
      matchRecipe(recipe, "https://example.test", {
        ...report,
        status: "partial",
      }),
    ).toBeUndefined();
    expect(
      matchRecipe(recipe, "https://example.test", {
        ...report,
        candidates: [candidate, { ...candidate, id: "table-2" }],
      }),
    ).toBeUndefined();
  });
  it("supports a prior settings version, rejects unknown versions, and normalizes names", () => {
    expect(parseStorageSettings(undefined)).toEqual(defaultStorageSettings);
    expect(parseStorageSettings({ version: 1, retentionDays: 7 })).toEqual({
      ...defaultStorageSettings,
      cleanupDays: 7,
    });
    expect(parseStorageSettings({ version: 2, cleanupDays: 90 })).toEqual({
      ...defaultStorageSettings,
      cleanupDays: 90,
    });
    expect(() => parseStorageSettings({ version: 3, cleanupDays: 90 })).toThrow(
      /unsupported/,
    );
    expect(() => parseStorageSettings({ version: 2, cleanupDays: 0 })).toThrow(
      /unsupported/,
    );
    expect(
      parseStorageSettings({
        ...defaultStorageSettings,
        exportFormat: "json",
        pageSteps: 2,
        pageDelay: 1700,
        deduplicate: true,
      }),
    ).toMatchObject({
      exportFormat: "json",
      pageSteps: 2,
      pageDelay: 1700,
      deduplicate: true,
    });
    expect(() =>
      parseStorageSettings({ ...defaultStorageSettings, pageSteps: 99 }),
    ).toThrow(/unsupported/);
    expect(cleanedName("  Cafe\u0301\u200B\n  ")).toBe("Café");
    expect(() => cleanedName("  \u200B")).toThrow(/Enter a name/);
  });
});
