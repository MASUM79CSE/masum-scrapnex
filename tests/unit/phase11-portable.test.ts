import { expect, it } from "vitest";
import type { DetectedCandidate } from "../../src/core/detector/contracts";
import { extractionDiagnostics } from "../../src/core/detector/diagnostics";
import { newRecipe } from "../../src/core/library/contracts";
import {
  configurationFileLimit,
  decodeConfiguration,
  encodeConfiguration,
  importedConfiguration,
} from "../../src/core/library/portable";

const candidate: DetectedCandidate = {
  id: "private-selector",
  kind: "table",
  score: 65,
  observed: 2,
  estimate: 12,
  sampled: true,
  columns: [
    { id: "t1", kind: "text", label: "Column label" },
    { id: "t2", kind: "url", label: "Reference" },
  ],
  rows: [
    ["secret text", "https://example.test/private"],
    ["", null],
  ],
  explanations: ["private note"],
};
const recipe = newRecipe(
  "নমুনা",
  "https://example.test/path?secret=1",
  candidate,
  "internal-id",
  1,
);
it("exchanges only normalized site, name, kind and schema; imports with fresh local identity", () => {
  const text = encodeConfiguration(recipe);
  expect(text).not.toMatch(/secret|private|savedAt|internal-id/);
  const portable = decodeConfiguration(text);
  expect(importedConfiguration(portable, "fresh-id", 123)).toEqual({
    ...recipe,
    id: "fresh-id",
    savedAt: 123,
  });
});
it("rejects untrusted configuration extensions, mismatched schemas, origins and oversize files", () => {
  const json = (patch: object) =>
    JSON.stringify({
      format: "masum-scrapnexs-configuration",
      version: 1,
      configuration: {
        ...decodeConfiguration(encodeConfiguration(recipe)),
        ...patch,
      },
    });
  for (const patch of [
    { origin: "https://example.test/secret" },
    { origin: "javascript:alert(1)" },
    { origin: "https://person:secret@example.test" },
    { path: "/admin" },
    { selectors: ["#hidden"] },
    { signature: '["products",[["t1","Column","text"]]]' },
    { signature: '["table",[["t1","A","text"],["t1","B","url"]]]' },
  ]) {
    expect(() => decodeConfiguration(json(patch))).toThrow();
  }
  expect(() => decodeConfiguration("é".repeat(configurationFileLimit))).toThrow(
    /24 KiB/,
  );
  expect(() => decodeConfiguration("{}")).toThrow(/Unsupported/);
});
it("exposes only scan metrics, separating missing values from blank strings", () => {
  const data = extractionDiagnostics({
    version: 1,
    status: "partial",
    notes: ["secret note"],
    candidates: [candidate],
  });
  expect(data).toEqual({
    version: 1,
    status: "partial",
    candidateCount: 1,
    candidates: [
      {
        kind: "table",
        score: 65,
        observed: 2,
        estimate: 12,
        sampled: true,
        columns: 2,
        previewRows: 2,
        blank: 1,
        missing: 1,
      },
    ],
  });
  expect(JSON.stringify(data)).not.toMatch(
    /secret|private|example|Column label/,
  );
});
