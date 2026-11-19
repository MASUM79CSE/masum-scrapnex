import { describe, expect, it } from "vitest";
import {
  changedPage,
  isPageDetection,
} from "../../src/core/detector/contracts";
import { safeWebUrl, uniqueLabels } from "../../src/core/detector/dom";

describe("detector data boundary", () => {
  it("resolves relative URLs without enabling navigable or credential-bearing schemes", () => {
    const base = "https://example.test/a/";
    expect(safeWebUrl("../img.jpg", base)).toBe("https://example.test/img.jpg");
    for (const url of [
      "javascript:void(0)",
      "data:text/html,foo",
      "https://name:secret@example.test",
      "http://[",
      "",
      "x".repeat(641),
    ])
      expect(safeWebUrl(url, base)).toBeNull();
  });
  it("generates stable case-insensitively unique labels", () => {
    expect(uniqueLabels(["Name", "name", "Name 2", "Name"])).toEqual([
      "Name",
      "name 2",
      "Name 2 2",
      "Name 3",
    ]);
  });
  it("rejects malformed reports, invalid kinds, duplicates, wide rows and oversized values", () => {
    expect(isPageDetection(changedPage())).toBe(true);
    const candidate = {
      id: "r1",
      kind: "list",
      observed: 2,
      estimate: 2,
      sampled: false,
      score: 75,
      explanations: ["List"],
      columns: [{ id: "c1", label: "Text", kind: "text" }],
      rows: [["Example"], [null]],
    };
    const report = {
      version: 1,
      status: "complete",
      candidates: [candidate],
      notes: [],
    };
    expect(isPageDetection(report)).toBe(true);
    for (const value of [
      null,
      { ...report, version: 2 },
      { ...report, status: "changed" },
      { ...report, candidates: [candidate, candidate] },
      ...[
        { ...candidate, kind: "toString" },
        { ...candidate, estimate: 1 },
        { ...candidate, rows: [["x", "y"]] },
        { ...candidate, rows: [["x".repeat(641)]] },
        { ...candidate, score: Infinity },
      ].map((item) => ({ ...report, candidates: [item] })),
    ])
      expect(isPageDetection(value)).toBe(false);
  });
});
