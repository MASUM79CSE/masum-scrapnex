import { describe, expect, it } from "vitest";
import {
  isCollectionResult,
  maxDatasetUnits,
  normalizeCell,
  type Dataset,
} from "../../src/core/extraction/contracts";
import {
  deleteColumn,
  duplicateIds,
  editCell,
  moveColumn,
  removeRows,
  renameColumn,
  rowWindow,
  visibleRecords,
} from "../../src/core/extraction/edit";
const fixture = (): Dataset => ({
  version: 1,
  columns: [
    { id: "c1", kind: "text", label: "Name" },
    { id: "c2", kind: "url", label: "URL" },
  ],
  rows: [
    { id: "r1", cells: ["Item 10", "https://example.com/a"] },
    { id: "r2", cells: ["Item 2", null] },
    { id: "r3", cells: ["Item 2", null] },
    { id: "r4", cells: [null, ""] },
    { id: "r5", cells: ["", ""] },
  ],
});
describe("Phase 07 extraction and editing contracts", () => {
  it("normalizes text and does not conflate explicit empty with missing", () => {
    expect(normalizeCell(" \u0000 Cafe\u0301\r\nবাংলা  ", "text")).toBe(
      "Café\nবাংলা",
    );
    expect(normalizeCell("  ", "text")).toBe("");
    expect(normalizeCell(null, "text")).toBeNull();
    expect(normalizeCell(`x${" ".repeat(639)}z`, "text")).toBe("x");
  });
  it("only accepts credential-free HTTP(S) URLs and rejects overlong URLs", () => {
    expect(normalizeCell("HTTPS://EXAMPLE.com/a", "image")).toBe(
      "https://example.com/a",
    );
    for (const unsafe of [
      "javascript:alert(1)",
      "data:image/svg+xml,x",
      "https://user:pass@example.com",
      "/relative",
      "http:example.com",
      `https://example.com/${"x".repeat(641)}`,
    ]) {
      expect(normalizeCell(unsafe, "url")).toBeNull();
    }
    expect(() => editCell(fixture(), "r1", "c2", "file:///not-web")).toThrow(
      /HTTP/,
    );
  });
  it("validates bridge dimensions, IDs, types, URL values and budget", () => {
    const result = {
      version: 1,
      status: "complete",
      note: "test",
      dataset: fixture(),
    };
    expect(isCollectionResult(result)).toBe(true);
    expect(isCollectionResult({ ...result, status: "changed" })).toBe(false);
    result.dataset.rows[0]!.cells[1] = "javascript:alert(1)";
    expect(isCollectionResult(result)).toBe(false);
    result.dataset.rows[0]!.cells[1] = "";
    result.dataset.rows[1]!.id = "r1";
    expect(isCollectionResult(result)).toBe(false);
    const wide: Dataset = {
      version: 1,
      columns: [{ id: "c1", kind: "text", label: "Word" }],
      rows: Array.from(
        { length: Math.floor(maxDatasetUnits / 640) + 1 },
        (_, i) => ({ id: `r${i + 1}`, cells: ["x".repeat(640)] }),
      ),
    };
    expect(isCollectionResult({ ...result, dataset: wide })).toBe(false);
    const full = {
      ...wide,
      rows: [...wide.rows.slice(0, -1), { id: "end", cells: [""] }],
    };
    expect(() => editCell(full, "end", "c1", "slightly longer")).toThrow(
      /size limit/,
    );
  });
  it("filters and sorts without mutating capture order; marks exact duplicate rows only", () => {
    const data = fixture();
    expect(
      visibleRecords(data, "ITEM", "c1", "nonempty", {
        id: "c1",
        direction: "asc",
      }).map((r) => r.id),
    ).toEqual(["r2", "r3", "r1"]);
    expect(visibleRecords(data, "", "", "empty").map((r) => r.id)).toEqual([
      "r4",
      "r5",
    ]);
    expect(visibleRecords(data, "item", "c2", "all")).toEqual([]);
    expect([...duplicateIds(data.rows)]).toEqual(["r3"]);
    expect(
      removeRows(data, duplicateIds(data.rows)).rows.map((r) => r.id),
    ).toEqual(["r1", "r2", "r4", "r5"]);
    expect(data.rows.map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
  });
  it("keeps row and column identities stable during edits and column moves", () => {
    const data = fixture();
    expect(() => renameColumn(data, "c1", "url")).toThrow(/unique/);
    const moved = moveColumn(
      renameColumn(
        editCell(data, "r2", "c1", "  Updated  "),
        "c1",
        " Product ",
      ),
      "c1",
      1,
    );
    expect(moved.columns.map((c) => c.label)).toEqual(["URL", "Product"]);
    expect(moved.rows[1]).toEqual({ id: "r2", cells: [null, "Updated"] });
    expect(deleteColumn(moved, "c2").rows[1]?.cells).toEqual(["Updated"]);
    expect(data.rows[1]?.cells).toEqual(["Item 2", null]);
  });
  it("keeps the virtual viewport bounded and at the bottom after a large jump", () => {
    expect(rowWindow(10000, 399600, 420)).toEqual({
      first: 9977,
      end: 10000,
      before: 399080,
      after: 0,
    });
    expect(rowWindow(0, 999, 420)).toEqual({
      first: 0,
      end: 0,
      before: 0,
      after: 0,
    });
  });
});
