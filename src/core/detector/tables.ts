import { inspectVisibility } from "../analyzer/visibility";
import {
  maxColumns,
  maxPreviewRows,
  type DetectedCandidate,
} from "./contracts";
import { uniqueLabels, visibleText } from "./dom";

const rowLimit = 32;
interface Occupied {
  remaining: number;
  value: string | null;
}

export function detectTable(
  table: HTMLTableElement,
  index: number,
  view: Window,
): DetectedCandidate | undefined {
  if (
    !table.isConnected ||
    /^(presentation|none)$/i.test(table.getAttribute("role") ?? "")
  )
    return;
  const headers: (string | null)[][] = [];
  const records: (string | null)[][] = [];
  const rowTotal = table.rows.length;
  const boundedRows = Math.min(rowTotal, rowLimit);
  let section: Element | null = null;
  let occupied = new Map<number, Occupied>();
  let width = 0;
  let footer = 0;
  let skipped = 0;
  let clippedColumns = false;
  let sawData = false;
  let spanned = false;
  for (let rowIndex = 0; rowIndex < boundedRows; rowIndex++) {
    const row = table.rows.item(rowIndex);
    if (!row || row.closest("table") !== table) continue;
    const nextSection = row.parentElement;
    if (section !== nextSection) {
      occupied.clear();
      section = nextSection;
    }
    if (section?.localName === "tfoot") {
      footer += 1;
      continue;
    }
    if (
      inspectVisibility(row, view) !== "visible" ||
      (section &&
        section !== table &&
        inspectVisibility(section, view) === "prune")
    ) {
      skipped += 1;
      continue;
    }
    const first = row.cells.item(0);
    const header =
      section?.localName === "thead" ||
      (!sawData &&
        row.cells.length > 1 &&
        row.cells.length <= maxColumns &&
        first?.localName === "th" &&
        Array.from(row.cells).every(
          (cell) => cell.localName === "th" && cell.scope !== "row",
        ));
    if (
      !header &&
      occupied.size > 0 &&
      rowIndex > 0 &&
      headers.length > 0 &&
      !sawData
    )
      occupied.clear();
    const projection: (string | null)[] = [];
    const next = new Map<number, Occupied>();
    for (const [offset, span] of occupied) {
      projection[offset] = span.value;
      if (span.remaining > 1)
        next.set(offset, { remaining: span.remaining - 1, value: span.value });
    }
    let column = 0;
    for (let ci = 0; ci < Math.min(maxColumns, row.cells.length); ci++) {
      const cell = row.cells.item(ci);
      if (!cell) continue;
      while (occupied.has(column) && column < maxColumns) column++;
      if (column >= maxColumns) {
        clippedColumns = true;
        break;
      }
      const span = Math.max(1, Math.min(maxColumns - column, cell.colSpan));
      const remaining =
        cell.rowSpan === 0
          ? rowLimit
          : Math.min(rowLimit, Math.max(0, cell.rowSpan - 1));
      if (span > 1 || remaining > 0) spanned = true;
      if (cell.colSpan > span) clippedColumns = true;
      const text =
        inspectVisibility(cell, view) === "visible"
          ? visibleText(cell, view)
          : null;
      for (let offset = 0; offset < span && column < maxColumns; offset++) {
        // Do not overwrite a previous row span even on malformed source HTML.
        while (occupied.has(column) && column < maxColumns) column++;
        if (column >= maxColumns) {
          clippedColumns = true;
          break;
        }
        const value = header || offset === 0 ? text : null;
        projection[column] = value;
        if (remaining) next.set(column, { remaining, value });
        column++;
      }
    }
    if (row.cells.length > maxColumns) clippedColumns = true;
    occupied = next;
    width = Math.max(width, projection.length);
    if (header) headers.push(projection);
    else if (projection.some((value) => Boolean(value))) {
      records.push(projection);
      sawData = true;
    } else skipped += 1;
  }
  if (width < 2 || !records.length || (records.length < 2 && !headers.length))
    return;
  const names = uniqueLabels(
    Array.from({ length: width }, (_, n) => {
      const parts = headers
        .map((row) => row[n]?.trim())
        .filter((label): label is string => Boolean(label));
      return Array.from(new Set(parts)).join(" / ") || `Column ${n + 1}`;
    }),
  );
  const sampled = rowTotal > boundedRows;
  const explanations = [
    headers.length
      ? "Native table rows and header cells provide column names."
      : "Native table rows detected; neutral column names used.",
  ];
  if (spanned)
    explanations.push("Merged cells are projected into a rectangular preview.");
  if (sampled)
    explanations.push("Row count is estimated beyond the bounded table scan.");
  if (clippedColumns)
    explanations.push("Some columns are outside the preview limit.");
  return {
    id: `table-${index + 1}`,
    kind: "table",
    observed: records.length,
    estimate: sampled
      ? Math.max(
          records.length,
          Math.min(100_000, rowTotal - headers.length - skipped - footer),
        )
      : records.length,
    sampled,
    score: Math.min(
      98,
      69 +
        (headers.length ? 15 : 0) +
        Math.min(records.length, 12) +
        Math.min(width, 4),
    ),
    explanations,
    columns: names.map((label, n) => ({
      id: `t${n + 1}`,
      label,
      kind: "text",
    })),
    rows: records
      .slice(0, maxPreviewRows)
      .map((row) => Array.from({ length: width }, (_, n) => row[n] ?? null)),
  };
}
