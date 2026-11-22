import { describe, expect, it } from "vitest";
import type {
  DetectedCandidate,
  Kind,
} from "../../src/core/detector/contracts";
import { evidenceFor, rankCandidates } from "../../src/core/detector/rank";

function candidate(
  patch: Partial<DetectedCandidate> & { id: string; kind: Kind },
): DetectedCandidate {
  const columns = patch.columns ?? [
    { id: "c1", label: "Name", kind: "text" as const },
    { id: "c2", label: "Price", kind: "text" as const },
  ];
  const rows =
    patch.rows ??
    Array.from({ length: 4 }, (_, index) => [
      `Record ${index + 1}`,
      `${(index + 1) * 100}`,
    ]);
  return {
    observed: rows.length,
    estimate: rows.length,
    sampled: false,
    score: 80,
    explanations: ["Detected"],
    columns,
    rows,
    ...patch,
  };
}

describe("candidate ranking evidence", () => {
  it("scores filled, distinct, named and typed structures higher than sparse ones", () => {
    const rich = candidate({
      id: "rich",
      kind: "products",
      columns: [
        { id: "c1", label: "Product name", kind: "text" },
        { id: "c2", label: "Link", kind: "url" },
      ],
      rows: [
        ["Lamp", "https://example.test/lamp"],
        ["Pack", "https://example.test/pack"],
        ["Flask", "https://example.test/flask"],
      ],
    });
    const sparse = candidate({
      id: "sparse",
      kind: "cards",
      columns: [
        { id: "c1", label: "Column 1", kind: "text" },
        { id: "c2", label: "Column 2", kind: "text" },
      ],
      rows: [
        ["", null],
        ["", null],
        ["", null],
      ],
    });
    const better = evidenceFor(rich);
    const worse = evidenceFor(sparse);
    expect(better.fill).toBe(1);
    expect(worse.fill).toBe(0);
    expect(better.typed).toBeGreaterThan(worse.typed);
    expect(better.labelled).toBeGreaterThan(worse.labelled);
    expect(better.score).toBeGreaterThan(worse.score);
  });

  it("penalises navigation and site-chrome rows even when their base score is high", () => {
    const nav = candidate({
      id: "nav",
      kind: "list",
      score: 96,
      rows: [
        ["Sign in", "https://example.test/login"],
        ["Privacy policy", "https://example.test/privacy"],
        ["Cookie settings", "https://example.test/cookies"],
        ["Careers", "https://example.test/jobs"],
      ],
    });
    const records = candidate({
      id: "records",
      kind: "products",
      score: 82,
      rows: [
        ["Trail lamp", "৳900"],
        ["Camp pack", "৳2400"],
        ["Flask", "৳650"],
        ["Stool", "৳1200"],
      ],
    });
    expect(evidenceFor(nav).chrome).toBe(1);
    expect(evidenceFor(records).chrome).toBe(0);
    const [first] = rankCandidates([nav, records]);
    expect(first?.id).toBe("records");
  });

  it("is deterministic, does not mutate input, and keeps scores inside the schema range", () => {
    const input = [
      candidate({ id: "a", kind: "cards" }),
      candidate({ id: "b", kind: "table" }),
      candidate({ id: "c", kind: "cards" }),
    ];
    const snapshot = JSON.stringify(input);
    const once = rankCandidates(input);
    const twice = rankCandidates(input);
    expect(once.map(({ id }) => id)).toEqual(twice.map(({ id }) => id));
    expect(JSON.stringify(input)).toBe(snapshot);
    for (const item of once) {
      expect(Number.isInteger(item.score)).toBe(true);
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
      expect(item.explanations.every((line) => line.length <= 160)).toBe(true);
      expect(item.explanations.length).toBeLessThanOrEqual(10);
    }
  });

  it("prefers the wider, more complete structure on an otherwise equal page", () => {
    const narrow = candidate({
      id: "narrow",
      kind: "cards",
      columns: [{ id: "c1", label: "Column 1", kind: "text" }],
      rows: [["Lamp"], ["Pack"], ["Flask"]],
    });
    const wide = candidate({ id: "wide", kind: "cards" });
    expect(rankCandidates([narrow, wide])[0]?.id).toBe("wide");
  });
});
