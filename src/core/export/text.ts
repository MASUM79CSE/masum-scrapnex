import type { Cell } from "../extraction/contracts";
import type { ExportPlan } from "./plan";

/** Export-only hardening for files or clipboard text interpreted as spreadsheets. */
export function spreadsheetText(value: string) {
  const trimmed = value.normalize("NFKC").replace(/^[\s\p{Cc}\p{Cf}]*/u, "");
  return /^[=+@-]/u.test(trimmed) || /^[\s\p{Cf}]*[\t\r\n]/u.test(value)
    ? `'${value}`
    : value;
}
const quote = (cell: Cell) =>
  cell === null ? "" : `"${spreadsheetText(cell).replaceAll('"', '""')}"`;
export function delimited(plan: ExportPlan, separator: "," | "\t") {
  const lines = [plan.columns.map(({ label }) => quote(label)).join(separator)];
  for (const { cells } of plan.rows)
    lines.push(cells.map(quote).join(separator));
  return lines.join("\r\n") + "\r\n";
}
export function jsonText(plan: ExportPlan) {
  // String and null are the current cell types; do not parse numbers or dates from source text.
  const columns = plan.columns.map(({ id, label, kind }) => ({
    id,
    label,
    kind,
  }));
  const records = plan.rows.map(({ id, cells }) => ({
    id,
    values: Object.fromEntries(
      columns.map(({ label }, index) => [label, cells[index] ?? null]),
    ),
  }));
  return `${JSON.stringify({ version: 1, columns, records }, null, 2)}\n`;
}
