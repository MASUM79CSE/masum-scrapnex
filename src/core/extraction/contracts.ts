import { maxCellChars, maxColumns, type Column } from "../detector/contracts";
import { safeWebUrl } from "../detector/dom";

export const maxDatasetRows = 10_000;
export const maxDatasetUnits = 2_000_000;
export type Cell = string | null;
export interface RecordRow {
  id: string;
  cells: Cell[];
}
export interface Dataset {
  version: 1;
  columns: Column[];
  rows: RecordRow[];
}
export type CollectionResult =
  | {
      version: 1;
      status: "complete" | "partial";
      dataset: Dataset;
      note: string;
    }
  | { version: 1; status: "changed" | "unavailable"; note: string };
export function normalizeCell(value: Cell, kind: Column["kind"]): Cell {
  if (value === null) return null;
  // Strip non-printing ASCII controls but preserve tab and newline in text.
  /* eslint-disable no-control-regex */
  const clean = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .trim()
    .slice(0, maxCellChars)
    .trimEnd();
  /* eslint-enable no-control-regex */
  if (kind === "text" || clean === "") return clean;
  if (!/^https?:\/\//i.test(clean) || value.length > maxCellChars) return null;
  return safeWebUrl(clean, "https://invalid.example/");
}
function object(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
export function isCollectionResult(v: unknown): v is CollectionResult {
  if (
    !object(v) ||
    v.version !== 1 ||
    typeof v.note !== "string" ||
    v.note.length > 240
  )
    return false;
  if (v.status === "changed" || v.status === "unavailable")
    return !Object.hasOwn(v, "dataset");
  if (v.status !== "complete" && v.status !== "partial") return false;
  const d = v.dataset;
  if (
    !object(d) ||
    d.version !== 1 ||
    !Array.isArray(d.columns) ||
    !Array.isArray(d.rows) ||
    d.rows.length > maxDatasetRows ||
    d.columns.length < 1 ||
    d.columns.length > maxColumns
  )
    return false;
  const ids = new Set<string>();
  for (const c of d.columns as unknown[]) {
    if (
      !object(c) ||
      typeof c.id !== "string" ||
      !/^[-a-z0-9]{1,25}$/i.test(c.id) ||
      ids.has(c.id) ||
      typeof c.label !== "string" ||
      !c.label ||
      c.label.length > 64 ||
      (c.kind !== "text" && c.kind !== "url" && c.kind !== "image")
    )
      return false;
    ids.add(c.id);
  }
  let units = 0;
  for (const [index, row] of (d.rows as unknown[]).entries()) {
    if (
      !object(row) ||
      row.id !== `r${index + 1}` ||
      !Array.isArray(row.cells) ||
      row.cells.length !== d.columns.length
    )
      return false;
    for (const [column, c] of (row.cells as unknown[]).entries()) {
      if (c !== null && (typeof c !== "string" || c.length > maxCellChars))
        return false;
      if (
        typeof c === "string" &&
        normalizeCell(c, (d.columns as Column[])[column]!.kind) !== c
      )
        return false;
      units += typeof c === "string" ? Math.max(1, c.length) : 1;
      if (units > maxDatasetUnits) return false;
    }
  }
  return true;
}
