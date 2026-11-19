import type { Dataset, RecordRow, Cell } from "./contracts";
import { maxDatasetUnits, normalizeCell } from "./contracts";

export type RowFilter = "all" | "nonempty" | "empty";
export type SortSpec = { id: string; direction: "asc" | "desc" };
const numeric = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const blank = (cell: Cell) => cell === null || cell.trim() === "";
export function visibleRecords(
  data: Dataset,
  query: string,
  column: string,
  filter: RowFilter,
  sort?: SortSpec,
) {
  const search = query.trim().normalize("NFC").toLocaleLowerCase();
  const at = data.columns.findIndex(({ id }) => id === column);
  const result = data.rows.filter((row) => {
    if (filter !== "all" && row.cells.every(blank) !== (filter === "empty"))
      return false;
    if (!search) return true;
    return (at < 0 ? row.cells : [row.cells[at]]).some((item) =>
      item?.toLocaleLowerCase().includes(search),
    );
  });
  const by = data.columns.findIndex(({ id }) => id === sort?.id);
  if (sort && by >= 0)
    result.sort((a, b) => {
      const left = a.cells[by] ?? null,
        right = b.cells[by] ?? null;
      if (left === null || right === null)
        return left === right ? 0 : left === null ? 1 : -1;
      return (sort.direction === "asc" ? 1 : -1) * numeric.compare(left, right);
    });
  return result;
}
export function duplicateIds(rows: readonly RecordRow[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const key = JSON.stringify(row.cells);
    if (seen.has(key)) duplicates.add(row.id);
    else seen.add(key);
  }
  return duplicates;
}
export function removeRows(data: Dataset, ids: ReadonlySet<string>): Dataset {
  return { ...data, rows: data.rows.filter((row) => !ids.has(row.id)) };
}
export function editCell(
  data: Dataset,
  rowId: string,
  columnId: string,
  value: Cell,
): Dataset {
  const index = data.columns.findIndex((col) => col.id === columnId);
  const column = data.columns[index];
  if (!column) return data;
  const normalized = normalizeCell(value, column.kind);
  if (normalized === null && value !== null)
    throw new Error("Enter a full HTTP or HTTPS URL without credentials.");
  const previous = data.rows.find((row) => row.id === rowId);
  if (!previous) return data;
  const measure = (cell: Cell | undefined) => Math.max(1, cell?.length ?? 0);
  const growth = measure(normalized) - measure(previous.cells[index]);
  if (
    growth > 0 &&
    data.rows.reduce(
      (units, row) =>
        units + row.cells.reduce((acc, cell) => acc + measure(cell), 0),
      growth,
    ) > maxDatasetUnits
  )
    throw new Error("This edit would exceed the working dataset size limit.");
  return {
    ...data,
    rows: data.rows.map((row) =>
      row.id !== rowId
        ? row
        : {
            ...row,
            cells: row.cells.map((cell, i) =>
              i === index ? normalized : cell,
            ),
          },
    ),
  };
}
export function renameColumn(
  data: Dataset,
  id: string,
  label: string,
): Dataset {
  const value = label.trim().normalize("NFC").slice(0, 64);
  if (
    !value ||
    data.columns.some(
      (col) => col.id !== id && col.label.toLowerCase() === value.toLowerCase(),
    )
  )
    throw new Error("Enter a nonempty, unique column name.");
  return {
    ...data,
    columns: data.columns.map((col) =>
      col.id === id ? { ...col, label: value } : col,
    ),
  };
}
function againstOrder(data: Dataset, order: number[]): Dataset {
  return {
    ...data,
    columns: order.flatMap((index) =>
      data.columns[index] ? [data.columns[index]!] : [],
    ),
    rows: data.rows.map((row) => ({
      ...row,
      cells: order.map((index) => row.cells[index] ?? null),
    })),
  };
}
export function moveColumn(data: Dataset, id: string, step: -1 | 1): Dataset {
  const at = data.columns.findIndex((col) => col.id === id);
  const to = at + step;
  if (at < 0 || to < 0 || to >= data.columns.length) return data;
  const order = data.columns.map((_, index) => index);
  order[at] = to;
  order[to] = at;
  return againstOrder(data, order);
}
export function deleteColumn(data: Dataset, id: string): Dataset {
  if (data.columns.length <= 1) return data;
  return againstOrder(
    data,
    data.columns.flatMap((col, index) => (col.id === id ? [] : [index])),
  );
}
export function rowWindow(
  count: number,
  scrollTop: number,
  viewport: number,
  rowHeight = 40,
) {
  const length = Math.max(1, Math.ceil(viewport / rowHeight) + 12);
  const first = Math.max(
    0,
    Math.min(
      Math.max(0, count - length),
      Math.floor(Math.max(0, scrollTop - rowHeight) / rowHeight) - 6,
    ),
  );
  const end = Math.min(count, first + length);
  return {
    first,
    end,
    before: first * rowHeight,
    after: (count - end) * rowHeight,
  };
}
