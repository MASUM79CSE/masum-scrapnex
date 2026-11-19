import { ArrowDown, ArrowUp, Crosshair, X } from "lucide-react";
import { useState } from "react";
import {
  allowedAttributes,
  maxFields,
  type AllowedAttribute,
  type FieldKind,
  type PickerCommand,
  type PickerPreview,
  type PickerState,
} from "../core/picker/contracts";

export interface PickerView {
  status:
    "idle" | "connecting" | "active" | "collecting" | "confirmed" | "error";
  state: PickerState | null;
  confirmation: PickerPreview | null;
  error: string;
  start: () => void;
  close: () => void;
  command: (message: PickerCommand) => void;
}
const fieldOptions: readonly { id: FieldKind; label: string }[] = [
  { id: "text", label: "Visible text" },
  { id: "link", label: "Link URL" },
  { id: "image", label: "Image URL" },
  { id: "alt", label: "Image alt text" },
  { id: "attribute", label: "Allowed attribute" },
];

export function PickerPanel({
  picker,
  canCollect = false,
}: {
  picker: PickerView;
  canCollect?: boolean;
}) {
  const [kind, setKind] = useState<FieldKind>("text");
  const [attribute, setAttribute] = useState<AllowedAttribute>("data-price");
  const preview = picker.confirmation ?? picker.state?.preview;
  const working = picker.status === "active";
  const review = working && picker.state?.phase === "review";
  const hint =
    picker.status === "collecting"
      ? "Collecting the selected rows…"
      : picker.status === "confirmed"
        ? "Selection confirmed. This preview is held in memory only."
        : picker.status === "connecting"
          ? "Connecting to the authorized page…"
          : picker.state?.hint;
  return (
    <section className="panel picker-panel" aria-label="Point-and-click picker">
      <header className="card-head">
        <div className="card-lead">
          <span className="section-icon">
            <Crosshair size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>Point-and-click picker</h2>
            <p>Select a row and choose what its peers should preview.</p>
          </div>
        </div>
        <button
          type="button"
          className="button button--outline"
          onClick={picker.close}
        >
          <X size={15} aria-hidden="true" />
          {working ||
          picker.status === "connecting" ||
          picker.status === "collecting"
            ? "Cancel picker"
            : picker.status === "confirmed"
              ? "Clear preview"
              : "Close picker"}
        </button>
      </header>
      {picker.status === "error" && (
        <p className="picker-hint" role="alert">
          {picker.error}
        </p>
      )}
      {hint && (
        <p className="picker-hint" role="status">
          {hint}
        </p>
      )}
      {working && (
        <div className="picker-tools">
          <button
            type="button"
            className="button button--outline"
            onClick={() => picker.command({ v: 1, action: "pick-row" })}
          >
            Pick new row
          </button>
          {preview && (
            <>
              <button
                type="button"
                className="button button--outline"
                disabled={!preview.canParent}
                onClick={() => picker.command({ v: 1, action: "parent" })}
              >
                <ArrowUp size={15} aria-hidden="true" /> Parent
              </button>
              <button
                type="button"
                className="button button--outline"
                disabled={!preview.canChild}
                onClick={() => picker.command({ v: 1, action: "child" })}
              >
                <ArrowDown size={15} aria-hidden="true" /> First child
              </button>
            </>
          )}
        </div>
      )}
      {preview && (
        <>
          <div className="picker-selector">
            <strong>Inspected selector</strong>
            <code>{preview.selector}</code>
            <span>
              {preview.sampled ? "At least " : ""}
              {preview.observed} similar{" "}
              {preview.observed === 1 ? "row" : "rows"} · {preview.rows.length}{" "}
              shown
            </span>
          </div>
          {working && (
            <div className="picker-fields">
              <label>
                Field type{" "}
                <select
                  value={kind}
                  onChange={(event) => {
                    const next = fieldOptions.find(
                      (option) => option.id === event.target.value,
                    );
                    if (next) setKind(next.id);
                  }}
                >
                  {fieldOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {kind === "attribute" && (
                <label>
                  Attribute name{" "}
                  <select
                    value={attribute}
                    onChange={(event) => {
                      const next = allowedAttributes.find(
                        (name) => name === event.target.value,
                      );
                      if (next) setAttribute(next);
                    }}
                  >
                    {allowedAttributes.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="button button--outline"
                disabled={
                  !review ||
                  (preview.explicitFields &&
                    preview.columns.length >= maxFields)
                }
                onClick={() =>
                  picker.command({
                    v: 1,
                    action: "pick-field",
                    rule: kind === "attribute" ? { kind, attribute } : { kind },
                  })
                }
              >
                Pick field
              </button>
            </div>
          )}
          <div
            className="table-scroll live-table"
            tabIndex={0}
            role="region"
            aria-label="Manual preview table (scroll horizontally if needed)"
          >
            <table>
              <caption className="sr-only">Manual selection preview</caption>
              <thead>
                <tr>
                  {preview.columns.map((item, index) => (
                    <th scope="col" key={index}>
                      {item.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((item, column) => (
                      <td key={column}>
                        {item ?? <span aria-label="Missing value">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.explicitFields && (
            <details className="match-reasons">
              <summary>Inspect field selectors</summary>
              <ol>
                {preview.columns.map((column, index) => (
                  <li key={index}>
                    {column.label} <code>{column.selector}</code>
                    {working && (
                      <button
                        type="button"
                        className="button button--quiet"
                        aria-label={`Remove ${column.label}`}
                        onClick={() =>
                          picker.command({
                            v: 1,
                            action: "remove-field",
                            index,
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </details>
          )}
          {working && (
            <footer className="picker-tools">
              <button
                type="button"
                className="button button--primary"
                disabled={!review}
                onClick={() => picker.command({ v: 1, action: "confirm" })}
              >
                Confirm selection
              </button>
              {canCollect && (
                <button
                  type="button"
                  className="button button--outline"
                  disabled={!review}
                  onClick={() => picker.command({ v: 1, action: "collect" })}
                >
                  Collect selected rows
                </button>
              )}
            </footer>
          )}
        </>
      )}
    </section>
  );
}
