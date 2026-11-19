import type { Column } from "../detector/contracts";
import {
  maxDatasetRows,
  maxDatasetUnits,
  type Cell,
  type Dataset,
  type RecordRow,
} from "../extraction/contracts";
export const maxExportBytes = 32 * 1024 * 1024;
export const formats = ["csv", "xlsx", "json"] as const;
export type Format = (typeof formats)[number];
export type RowScope = "all" | "visible" | "selected";
export interface ExportPlan {
  columns: Column[];
  rows: { id: string; cells: Cell[] }[];
}
export function createPlan(
  dataset: Dataset,
  view: readonly RecordRow[],
  selected: ReadonlySet<string>,
  excludedColumns: ReadonlySet<string>,
  scope: RowScope,
): ExportPlan {
  const cols = dataset.columns.flatMap((column, index) =>
    excludedColumns.has(column.id) ? [] : [{ column, index }],
  );
  const source =
    scope === "visible"
      ? view
      : scope === "selected"
        ? dataset.rows.filter((row) => selected.has(row.id))
        : dataset.rows;
  if (!cols.length || !source.length)
    throw new Error("Choose at least one column and one record to export.");
  if (source.length > maxDatasetRows || cols.length > 12)
    throw new Error("Export exceeds the working dataset limits.");
  let units = 0;
  const rows = source.map((row) => ({
    id: row.id,
    cells: cols.map(({ index }) => {
      const value = row.cells[index] ?? null;
      units += Math.max(1, value?.length ?? 0);
      if (units > maxDatasetUnits)
        throw new Error("Export exceeds the working dataset size limit.");
      return value;
    }),
  }));
  return { columns: cols.map(({ column }) => column), rows };
}
export function defaultStem(date = new Date()) {
  return `scrapnexs-${date.toISOString().replace(/[-:]/g, "").slice(0, 15).toLowerCase()}z`;
}
export function safeFilename(name: string, format: Format) {
  // Isolate the leaf name; trim formatting controls and Windows-reserved names.
  let stem = name
    .normalize("NFC")
    .replace(/\.(?:csv|json|xlsx)$/i, "")
    .replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]/gu, "-")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .replace(/\s+/gu, " ");
  stem = Array.from(stem)
    .slice(0, 75)
    .join("")
    .replace(/[.\s]+$/g, "");
  // Avoid exceeding common filesystem byte limits with multibyte input.
  const utf8 = new TextEncoder();
  while (utf8.encode(stem).length > 200)
    stem = Array.from(stem).slice(0, -1).join("");
  stem = stem.replace(/[.\s]+$/g, "");
  if (!stem) stem = "scrapnexs-export";
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(stem))
    stem = `scrapnexs-${stem}`;
  return `${stem}.${format}`;
}
