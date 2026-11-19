import { Clipboard, Download } from "lucide-react";
import { useRef, useState } from "react";
import {
  canChooseSaveLocation,
  copyExport,
  saveExport,
} from "../browser/export";
import {
  createPlan,
  defaultStem,
  formats,
  type Format,
  type RowScope,
} from "../core/export/plan";
import type { Dataset, RecordRow } from "../core/extraction/contracts";

export function ExportPanel({
  data,
  view,
  selected,
}: {
  data: Dataset;
  view: RecordRow[];
  selected: ReadonlySet<string>;
}) {
  const [scope, setScope] = useState<RowScope>("all");
  const [format, setFormat] = useState<Format>("csv");
  const [stem, setStem] = useState(() => defaultStem());
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [choose, setChoose] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const rowCount =
    scope === "all"
      ? data.rows.length
      : scope === "visible"
        ? view.length
        : selected.size;
  const columnCount = data.columns.filter(
    (column) => !excluded.has(column.id),
  ).length;
  function toggle(id: string) {
    setExcluded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function perform(copy: boolean) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const plan = createPlan(data, view, selected, excluded, scope);
      if (copy) {
        await copyExport(plan);
        setMessage(
          `Copied ${plan.rows.length.toLocaleString()} ${plan.rows.length === 1 ? "record" : "records"} to the clipboard.`,
        );
      } else {
        const result = await saveExport(plan, format, stem, choose);
        setMessage(
          result.status === "cancelled"
            ? "Save cancelled. No file was written."
            : result.status === "saved"
              ? `Saved ${result.name}.`
              : `Download requested for ${result.name}. Check Chrome Downloads for its status.`,
        );
      }
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "The export could not be prepared.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="export-panel">
      <summary>Export and copy records</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void perform(false);
        }}
      >
        <div className="export-options">
          <label>
            Records to include
            <select
              value={scope}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "all" ||
                  value === "visible" ||
                  value === "selected"
                )
                  setScope(value);
              }}
            >
              <option value="all">All records</option>
              <option value="visible">Filtered and sorted view</option>
              <option value="selected">Selected records</option>
            </select>
          </label>
          <label>
            File format
            <select
              value={format}
              onChange={(event) => {
                const value = formats.find(
                  (item) => item === event.target.value,
                );
                if (value) setFormat(value);
              }}
            >
              <option value="csv">CSV (.csv)</option>
              <option value="xlsx">Excel workbook (.xlsx)</option>
              <option value="json">JSON (.json)</option>
            </select>
          </label>
          <label>
            File name
            <input
              value={stem}
              maxLength={120}
              onChange={(event) => setStem(event.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>Columns to include</legend>
          <div className="export-columns">
            {data.columns.map((column) => (
              <label key={column.id}>
                <input
                  type="checkbox"
                  checked={!excluded.has(column.id)}
                  onChange={() => toggle(column.id)}
                />
                {column.label}
              </label>
            ))}
          </div>
        </fieldset>
        {canChooseSaveLocation() && (
          <label className="export-check">
            <input
              type="checkbox"
              checked={choose}
              onChange={(event) => setChoose(event.target.checked)}
            />{" "}
            Choose save location
          </label>
        )}
        <p className="export-note">
          {rowCount.toLocaleString()} records · {columnCount} columns. Clipboard
          copies tab-separated text with headers. Selected rows are included
          even when hidden by a filter.
        </p>
        <div className="export-options">
          <button
            type="submit"
            className="button button--primary"
            disabled={busy || !rowCount || !columnCount}
          >
            <Download size={15} aria-hidden="true" />
            {choose ? "Save" : "Download"} {format.toUpperCase()}
          </button>
          <button
            type="button"
            className="button button--outline"
            disabled={busy || !rowCount || !columnCount}
            onClick={() => void perform(true)}
          >
            <Clipboard size={15} aria-hidden="true" />
            Copy{" "}
            {scope === "selected"
              ? "selected records"
              : scope === "visible"
                ? "filtered records"
                : "all records"}
          </button>
        </div>
        {message && (
          <p role="status" className="export-note export-ok">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="export-note export-error">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
