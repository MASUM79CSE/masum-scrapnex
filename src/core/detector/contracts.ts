export const maxStructures = 8;
export const maxPreviewRows = 6;
export const maxColumns = 12;
export const maxCellChars = 640;
export type Kind =
  "table" | "products" | "articles" | "directory" | "list" | "cards";
export const candidateLabels: Record<Kind, string> = {
  table: "HTML table",
  products: "Product listing",
  articles: "Article listing",
  directory: "Directory listing",
  list: "List",
  cards: "Repeating cards",
};
export interface Column {
  id: string;
  label: string;
  kind: "text" | "url" | "image";
}
export interface DetectedCandidate {
  id: string;
  kind: Kind;
  observed: number;
  estimate: number;
  sampled: boolean;
  score: number;
  explanations: string[];
  columns: Column[];
  rows: (string | null)[][];
}
export interface PageDetection {
  version: 1;
  status: "complete" | "partial" | "changed";
  candidates: DetectedCandidate[];
  notes: string[];
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function string(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
function int(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
  );
}
function strings(
  values: unknown,
  max: number,
  length: number,
): values is string[] {
  return (
    Array.isArray(values) &&
    values.length <= max &&
    values.every((item: unknown) => string(item, length))
  );
}
function column(value: unknown): value is Column {
  return (
    object(value) &&
    string(value.id, 24) &&
    string(value.label, 64) &&
    (value.kind === "text" || value.kind === "url" || value.kind === "image")
  );
}
function candidate(value: unknown): value is DetectedCandidate {
  if (
    !object(value) ||
    !string(value.id, 32) ||
    !string(value.kind, 16) ||
    !Object.hasOwn(candidateLabels, value.kind) ||
    !int(value.observed, 100_000) ||
    !int(value.estimate, 100_000) ||
    value.estimate < value.observed ||
    typeof value.sampled !== "boolean" ||
    !int(value.score, 100) ||
    !strings(value.explanations, 10, 160) ||
    !Array.isArray(value.columns) ||
    !Array.isArray(value.rows)
  )
    return false;
  const { columns, rows } = value;
  return (
    columns.length > 0 &&
    columns.length <= maxColumns &&
    columns.every(column) &&
    new Set(columns.map((item) => item.id)).size === columns.length &&
    rows.length <= maxPreviewRows &&
    rows.length <= value.observed &&
    rows.every(
      (row: unknown) =>
        Array.isArray(row) &&
        row.length === columns.length &&
        row.every(
          (cell: unknown) => cell === null || string(cell, maxCellChars),
        ),
    )
  );
}

export function isPageDetection(value: unknown): value is PageDetection {
  return (
    object(value) &&
    value.version === 1 &&
    (value.status === "complete" ||
      value.status === "partial" ||
      value.status === "changed") &&
    strings(value.notes, 8, 160) &&
    Array.isArray(value.candidates) &&
    value.candidates.length <= maxStructures &&
    (value.status !== "changed" || value.candidates.length === 0) &&
    value.candidates.every(candidate) &&
    new Set(value.candidates.map((item) => item.id)).size ===
      value.candidates.length
  );
}

export function changedPage(): PageDetection {
  return {
    version: 1,
    status: "changed",
    candidates: [],
    notes: [
      "The page changed during detection. Wait for it to settle and try again.",
    ],
  };
}
