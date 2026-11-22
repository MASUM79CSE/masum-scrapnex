import { SaveSnapshot } from "./library-panel";
import type { LibraryView } from "../browser/use-library";
import { ExportPanel } from "./export-panel";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Database,
  Search,
  Trash2,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DatasetView } from "../browser/use-dataset";
import {
  deleteColumn,
  duplicateIds,
  editCell,
  moveColumn,
  removeRows,
  renameColumn,
  rowWindow,
  visibleRecords,
  type RowFilter,
  type SortSpec,
} from "../core/extraction/edit";
import type { Cell, Dataset } from "../core/extraction/contracts";
import { maxCellChars } from "../core/detector/contracts";
import { maxDatasetRows } from "../core/extraction/contracts";

const rowHeight = 40;
type Editor = { row: string; column: string; label: string; value: string };

export function DatasetPanel({
  view,
  library,
}: {
  view: DatasetView;
  library?: LibraryView | undefined;
}) {
  return view.dataset ? (
    <Grid dataset={view.dataset} view={view} library={library} />
  ) : null;
}
function Grid({
  dataset,
  view,
  library,
}: {
  dataset: Dataset;
  view: DatasetView;
  library?: LibraryView | undefined;
}) {
  const [query, setQuery] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filter, setFilter] = useState<RowFilter>("all");
  const [sort, setSort] = useState<SortSpec>();
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [managed, setManaged] = useState("");
  const [rename, setRename] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [jump, setJump] = useState("");
  const [height, setHeight] = useState(420);
  const scroll = useRef<HTMLDivElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  function closeEditor() {
    setEditor(null);
    setError("");
    if (editTrigger.current?.isConnected) editTrigger.current.focus();
    else scroll.current?.focus();
  }
  const viewRows = useMemo(
    () => visibleRecords(dataset, query, filterColumn, filter, sort),
    [dataset, query, filterColumn, filter, sort],
  );
  const duplicates = useMemo(() => duplicateIds(dataset.rows), [dataset.rows]);
  const window = rowWindow(viewRows.length, scrollTop, height, rowHeight);
  const managedIndex = dataset.columns.findIndex(
    (column) => column.id === managed,
  );
  const active = dataset.columns[managedIndex];
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
    setScrollTop(0);
  }, [query, filterColumn, filter, sort]);
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.clientHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  function toggle(id: string) {
    setSelection((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function apply(edit: (d: Dataset) => Dataset, message: string) {
    setError("");
    setNotice("");
    try {
      const next = edit(dataset);
      view.save(() => next);
      setNotice(message);
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update the dataset.",
      );
      return false;
    }
  }
  function erase(ids: ReadonlySet<string>, message: string) {
    if (apply((data) => removeRows(data, ids), message))
      setSelection(
        (previous) => new Set([...previous].filter((id) => !ids.has(id))),
      );
  }
  function commit(value: Cell) {
    if (
      editor &&
      apply(
        (data) => editCell(data, editor.row, editor.column, value),
        `Updated ${editor.label}.`,
      )
    )
      closeEditor();
  }
  function jumpTo(index: number) {
    if (
      !scroll.current ||
      !Number.isInteger(index) ||
      index < 1 ||
      index > viewRows.length
    )
      return;
    scroll.current.scrollTop = (index - 1) * rowHeight;
    setScrollTop(scroll.current.scrollTop);
    scroll.current.focus();
  }
  return (
    <section className="panel dataset-panel" aria-label="Working dataset">
      <header className="card-head">
        <div className="card-lead">
          <span className="section-icon">
            <Database size={19} aria-hidden="true" />
          </span>
          <div>
            <h2>Working dataset</h2>
            <p>{view.note}</p>
          </div>
        </div>
        <span className={`count-tag${view.partial ? " dataset-partial" : ""}`}>
          {view.partial ? "Partial capture" : "In memory"} ·{" "}
          {dataset.rows.length.toLocaleString()} rows
        </span>
      </header>
      {view.partial && (
        <div className="dataset-notice" role="status">
          <strong>Partial capture.</strong> Collection stopped at a limit — the{" "}
          {maxDatasetRows.toLocaleString()} row cap, a detected page limit, or
          the time budget. Everything captured is real and stays fully editable,
          exportable and saveable; nothing is silently padded. Narrow the scope
          or start from an earlier page to collect the remainder.
        </div>
      )}
      <div className="dataset-tools">
        <button
          type="button"
          className="button button--outline"
          onClick={view.back}
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to workspace
        </button>
        <button
          type="button"
          className="button button--outline"
          onClick={() => {
            if (confirm("Discard this dataset and its edits?")) view.discard();
          }}
        >
          Discard dataset
        </button>
      </div>
      <div className="dataset-tools dataset-filters">
        <label className="search-box">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search dataset</span>
          <input
            type="search"
            value={query}
            placeholder="Search captured rows…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Search column{" "}
          <select
            value={filterColumn}
            onChange={(event) => setFilterColumn(event.target.value)}
          >
            <option value="">All columns</option>
            {dataset.columns.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show rows{" "}
          <select
            value={filter}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "all" || value === "nonempty" || value === "empty")
                setFilter(value);
            }}
          >
            <option value="all">All rows</option>
            <option value="nonempty">Rows with data</option>
            <option value="empty">Empty rows only</option>
          </select>
        </label>
      </div>
      <details className="dataset-manage">
        <summary>Manage columns</summary>
        <div className="dataset-tools">
          <label>
            Column{" "}
            <select
              value={managed}
              onChange={(event) => {
                const id = event.target.value;
                setManaged(id);
                setRename(
                  dataset.columns.find((col) => col.id === id)?.label ?? "",
                );
              }}
            >
              <option value="">Choose a column</option>
              {dataset.columns.map(({ id, label }) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {active && (
            <>
              <form
                className="dataset-inline"
                onSubmit={(event) => {
                  event.preventDefault();
                  apply(
                    (data) => renameColumn(data, active.id, rename),
                    "Column renamed.",
                  );
                }}
              >
                <label>
                  New column name{" "}
                  <input
                    value={rename}
                    maxLength={64}
                    onChange={(event) => setRename(event.target.value)}
                  />
                </label>
                <button type="submit" className="button button--outline">
                  Rename column
                </button>
              </form>
              <button
                type="button"
                className="button button--outline"
                disabled={managedIndex === 0}
                onClick={() =>
                  apply(
                    (data) => moveColumn(data, active.id, -1),
                    "Column moved left.",
                  )
                }
              >
                <ArrowLeft size={14} aria-hidden="true" /> Move left
              </button>
              <button
                type="button"
                className="button button--outline"
                disabled={managedIndex === dataset.columns.length - 1}
                onClick={() =>
                  apply(
                    (data) => moveColumn(data, active.id, 1),
                    "Column moved right.",
                  )
                }
              >
                Move right <ArrowRight size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="button button--outline"
                disabled={dataset.columns.length <= 1}
                onClick={() => {
                  if (
                    !confirm(
                      `Remove the “${active.label}” column and its cells?`,
                    )
                  )
                    return;
                  if (
                    apply(
                      (data) => deleteColumn(data, active.id),
                      "Column removed.",
                    )
                  ) {
                    if (filterColumn === active.id) setFilterColumn("");
                    if (sort?.id === active.id) setSort(undefined);
                    if (editor?.column === active.id) setEditor(null);
                    setManaged("");
                    setRename("");
                  }
                }}
              >
                Remove column
              </button>
            </>
          )}
        </div>
      </details>
      {editor && (
        <form
          className="cell-editor"
          aria-label="Edit cell"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              closeEditor();
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            commit(editor.value);
          }}
        >
          <label>
            {editor.label} · Record {editor.row.slice(1)}
            <textarea
              autoFocus
              rows={2}
              maxLength={maxCellChars}
              value={editor.value}
              onChange={(event) =>
                setEditor({ ...editor, value: event.target.value })
              }
            />
          </label>
          <div className="dataset-inline">
            <button type="submit" className="button button--primary">
              Save cell
            </button>
            <button
              type="button"
              className="button button--outline"
              onClick={() => commit(null)}
            >
              Mark as missing
            </button>
            <button
              type="button"
              className="button button--outline"
              onClick={closeEditor}
            >
              Cancel edit
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="picker-hint" role="alert">
          {error}
        </p>
      )}
      <div
        className="dataset-grid table-scroll"
        ref={scroll}
        tabIndex={0}
        role="region"
        aria-label="Virtualized dataset table"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <table
          aria-rowcount={Math.max(2, viewRows.length + 1)}
          style={
            { "--dataset-columns": dataset.columns.length } as CSSProperties
          }
        >
          <caption className="sr-only">Captured records</caption>
          <thead>
            <tr aria-rowindex={1}>
              <th scope="col">
                <span className="sr-only">Select row</span>
              </th>
              <th scope="col">Row</th>
              {dataset.columns.map(({ id, label }) => (
                <th
                  key={id}
                  scope="col"
                  aria-sort={
                    sort?.id === id
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <button
                    className="sort-button"
                    type="button"
                    aria-label={`Sort by ${label}`}
                    onClick={() =>
                      setSort({
                        id,
                        direction:
                          sort?.id === id && sort.direction === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  >
                    {label}
                    {sort?.id === id ? (
                      sort.direction === "asc" ? (
                        <ArrowUp size={13} aria-hidden="true" />
                      ) : (
                        <ArrowDown size={13} aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown size={12} aria-hidden="true" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {window.before > 0 && (
              <tr aria-hidden="true" className="grid-spacer">
                <td
                  colSpan={dataset.columns.length + 2}
                  style={{ height: window.before }}
                />
              </tr>
            )}
            {viewRows.slice(window.first, window.end).map((row, index) => (
              <tr
                key={row.id}
                aria-rowindex={window.first + index + 2}
                className={selection.has(row.id) ? "selected-row" : undefined}
              >
                <td className="row-select">
                  <label className="row-check">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${row.id.slice(1)}`}
                      checked={selection.has(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </label>
                </td>
                <th scope="row">{window.first + index + 1}</th>
                {dataset.columns.map(({ id, label }, i) => {
                  const cell = row.cells[i] ?? null;
                  return (
                    <td key={id}>
                      <button
                        type="button"
                        className="grid-cell"
                        title={cell ?? "Missing value"}
                        // WCAG 2.5.3: the accessible name must contain the visible
                        // label, so the cell value is appended after the action.
                        aria-label={`Edit ${label} in row ${row.id.slice(1)}: ${
                          cell === null
                            ? "missing value"
                            : cell === ""
                              ? "empty"
                              : cell
                        }`}
                        onClick={(event) => {
                          editTrigger.current = event.currentTarget;
                          setError("");
                          setEditor({
                            row: row.id,
                            column: id,
                            label,
                            value: cell ?? "",
                          });
                        }}
                      >
                        {cell === null ? (
                          <span className="muted-value">—</span>
                        ) : cell === "" ? (
                          <span className="muted-value">Empty</span>
                        ) : (
                          cell
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {window.after > 0 && (
              <tr aria-hidden="true" className="grid-spacer">
                <td
                  colSpan={dataset.columns.length + 2}
                  style={{ height: window.after }}
                />
              </tr>
            )}
            {!viewRows.length && (
              <tr>
                <td colSpan={dataset.columns.length + 2}>
                  No rows match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="dataset-tools dataset-footer">
        <p role="status">
          {viewRows.length.toLocaleString()} of{" "}
          {dataset.rows.length.toLocaleString()} rows · {selection.size}{" "}
          selected · {duplicates.size} exact duplicates
        </p>
        <button
          type="button"
          className="button button--outline"
          disabled={!selection.size}
          onClick={() => {
            if (confirm(`Delete ${selection.size} selected row(s)?`))
              erase(selection, "Selected rows deleted.");
          }}
        >
          <Trash2 size={14} aria-hidden="true" /> Delete selected rows
        </button>
        <button
          type="button"
          className="button button--outline"
          disabled={!duplicates.size}
          onClick={() => {
            if (
              confirm(
                `Remove ${duplicates.size} exact duplicate(s), keeping the first occurrence?`,
              )
            )
              erase(duplicates, "Exact duplicates removed.");
          }}
        >
          Remove duplicates
        </button>
        <form
          className="dataset-inline dataset-jump"
          onSubmit={(event) => {
            event.preventDefault();
            jumpTo(Number(jump));
          }}
        >
          <label>
            Jump to row{" "}
            <input
              type="number"
              min={1}
              max={viewRows.length || 1}
              value={jump}
              onChange={(event) => setJump(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button button--outline"
            disabled={!viewRows.length || !jump}
          >
            Go
          </button>
        </form>
        {notice && (
          <p role="status" className="dataset-notice">
            {notice}
          </p>
        )}
      </footer>
      {library && (
        <SaveSnapshot library={library} data={dataset} partial={view.partial} />
      )}
      <ExportPanel
        defaultFormat={library?.settings.exportFormat}
        data={dataset}
        view={viewRows}
        selected={selection}
      />
    </section>
  );
}
