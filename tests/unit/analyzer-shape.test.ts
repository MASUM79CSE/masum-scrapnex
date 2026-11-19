import { describe, expect, it } from "vitest";
import {
  alignedFieldCoverage,
  ContentSignal as F,
  similarity,
  structureScore,
} from "../../src/core/analyzer/shape";

const shape = (root: string, tokens: [string, number][] = []) => ({
  root,
  tokens: new Map(tokens),
});

describe("DOM analyzer structural scoring", () => {
  it("uses multiset overlap rather than only distinct tags", () => {
    const a = shape("article", [
      ["1/h2", 1],
      ["1/p", 2],
    ]);
    const b = shape("article", [
      ["1/h2", 1],
      ["1/p", 1],
      ["1/time", 1],
    ]);
    expect(similarity(a, b)).toBe(0.5);
    expect(similarity(b, a)).toBe(0.5);
    expect(similarity(a, a)).toBe(1);
  });
  it("does not combine otherwise identical but different root shapes", () => {
    expect(similarity(shape("li"), shape("div"))).toBe(0);
    expect(similarity(shape("li"), shape("li"))).toBe(1);
  });
  it("rewards recurring signals, not one-off fields", () => {
    expect(
      alignedFieldCoverage([F.text | F.image, F.text, F.text]),
    ).toBeCloseTo(1 / 3);
    expect(
      alignedFieldCoverage([
        F.text | F.link | F.heading,
        F.text | F.link | F.heading,
      ]),
    ).toBe(1);
  });
  it("caps repetition and penalizes landmark-like structures", () => {
    const stats = {
      similarity: 1,
      alignment: 1,
      content: 1,
      count: 12,
      visibility: 1,
      penalty: 0,
    };
    expect(structureScore(stats)).toBe(100);
    expect(structureScore({ ...stats, count: 10_000 })).toBe(100);
    expect(structureScore({ ...stats, penalty: 40 })).toBe(60);
    expect(structureScore({ ...stats, penalty: 200 })).toBe(0);
  });
});
