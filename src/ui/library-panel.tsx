import { readSchema } from "../core/extraction/signature";
import { requestDownload } from "../browser/export";
import {
  encodeConfiguration,
  decodeConfiguration,
  configurationFileLimit,
  type PortableConfiguration,
} from "../core/library/portable";
import { formats, type Format } from "../core/export/plan";
import {
  isSettings,
  maxSteps,
  minDelay,
  maxDelay,
} from "../core/pagination/contracts";
import { Archive, Database, FolderOpen, Save, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { LibraryView } from "../browser/use-library";
import type {
  DetectedCandidate,
  PageDetection,
} from "../core/detector/contracts";
import type { Dataset } from "../core/extraction/contracts";
import {
  cleanupDays,
  configurationMatch,
  maxLibraryBytes,
  maxRecipes,
  maxSessions,
  type SavedSession,
} from "../core/library/contracts";

export function LibraryFeedback({ library }: { library: LibraryView }) {
  return (
    <>
      {library.error && (
        <p role="alert" className="settings-error library-feedback">
          {library.error}
        </p>
      )}
      {library.message && (
        <p role="status" className="library-feedback">
          {library.message}
        </p>
      )}
    </>
  );
}
export function SaveSnapshot({
  library,
  data,
  partial,
}: {
  library: LibraryView;
  data: Dataset;
  partial: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <details className="export-panel">
      <summary>Save working snapshot</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) library.save(name, data, partial);
        }}
      >
        <p className="export-note">
          Save a local copy of the current records and edits. The copy stays on
          this browser profile until you delete it or clear browser data.
        </p>
        <div className="export-options">
          <label>
            Snapshot name
            <input
              value={name}
              maxLength={80}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button button--outline"
            disabled={!name.trim() || !data.rows.length || library.busy}
          >
            <Save size={15} aria-hidden="true" /> Save snapshot
          </button>
        </div>
      </form>
    </details>
  );
}
export function SaveRecipe({
  library,
  candidate,
  origin,
}: {
  library: LibraryView;
  candidate: DetectedCandidate;
  origin: string;
}) {
  const [name, setName] = useState("");
  return (
    <details className="export-panel recipe-save">
      <summary>Save extraction configuration</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) library.recipe(name, origin, candidate);
        }}
      >
        <p className="export-note">
          Save the inferred structure and column layout for this site. No rows,
          route, or automatic actions are saved.
        </p>
        <div className="export-options">
          <label>
            Configuration name
            <input
              value={name}
              maxLength={80}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button button--outline"
            disabled={!name.trim() || library.busy}
          >
            <Save size={15} aria-hidden="true" /> Save configuration
          </button>
        </div>
      </form>
    </details>
  );
}
function Usage({ library }: { library: LibraryView }) {
  const readable =
    library.bytes < 1024
      ? `${library.bytes.toLocaleString()} B`
      : library.bytes < 1048576
        ? `${(library.bytes / 1024).toFixed(1)} KiB`
        : `${(library.bytes / 1048576).toFixed(2)} MiB`;
  return (
    <p className="settings-copy library-usage">
      {readable} of {maxLibraryBytes / 1048576} MiB snapshot data ·{" "}
      {library.sessions.length} of {maxSessions} snapshots ·{" "}
      {library.recipes.length} of {maxRecipes} configurations
    </p>
  );
}
export function StorageControls({ library }: { library: LibraryView }) {
  return (
    <section
      className="panel settings-card"
      aria-label="Local storage controls"
    >
      <div className="card-head">
        <div className="card-lead">
          <span className="section-icon">
            <Database size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>Local storage</h2>
            <p>
              Saved snapshots and configurations stay on this browser profile.
            </p>
          </div>
        </div>
      </div>
      <Usage library={library} />
      <div className="export-options library-tools">
        <label>
          Cleanup age
          <select
            value={library.settings.cleanupDays}
            disabled={library.busy || library.loading}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (cleanupDays(value)) library.setDays(value);
            }}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
        <button
          type="button"
          className="button button--outline"
          disabled={library.busy || !library.sessions.length}
          onClick={() => {
            if (
              confirm(
                `Delete saved snapshots older than ${library.settings.cleanupDays} days?`,
              )
            )
              library.clean();
          }}
        >
          Clean older snapshots
        </button>
        <button
          type="button"
          className="button button--outline"
          disabled={library.busy || !library.sessions.length}
          onClick={() => {
            if (
              confirm(
                "Permanently delete all saved snapshots? This will not delete configurations or the open working copy.",
              )
            )
              library.clearHistory();
          }}
        >
          Clear snapshot history
        </button>
        <button
          type="button"
          className="button button--outline"
          disabled={library.busy || !library.recipes.length}
          onClick={() => {
            if (confirm("Permanently delete all saved configurations?"))
              library.clearRecipes();
          }}
        >
          Clear saved configurations
        </button>
        <button
          type="button"
          className="button button--outline"
          disabled={library.busy}
          onClick={library.refresh}
        >
          Refresh local storage
        </button>
      </div>
      <p className="settings-copy library-usage">
        Usage measures saved dataset bytes, not database overhead or
        browser-wide storage. The cleanup age applies only when you run cleanup.
      </p>
    </section>
  );
}
export function WorkflowSettings({ library }: { library: LibraryView }) {
  const defaults = library.settings;
  const [format, setFormat] = useState<Format | null>(null),
    [steps, setSteps] = useState<string | null>(null),
    [delay, setDelay] = useState<string | null>(null),
    [dedupe, setDedupe] = useState<boolean | null>(null);
  const paging = {
    steps: Number(steps ?? defaults.pageSteps),
    delay: Number(delay ?? defaults.pageDelay),
  };
  return (
    <section className="panel settings-card" aria-label="Workflow defaults">
      <div className="card-head">
        <div className="card-lead">
          <span className="section-icon">
            <Save size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>Workflow defaults</h2>
            <p>
              Set starting values for new captures and exports. Each pagination
              run still requires authorization.
            </p>
          </div>
        </div>
      </div>
      <form
        className="library-tools"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isSettings(paging)) return;
          library.defaults({
            exportFormat: format ?? defaults.exportFormat,
            pageSteps: paging.steps,
            pageDelay: paging.delay,
            deduplicate: dedupe ?? defaults.deduplicate,
          });
        }}
      >
        <div className="export-options">
          <label>
            Default export format
            <select
              value={format ?? defaults.exportFormat}
              onChange={(event) => {
                const next = formats.find(
                  (item) => item === event.target.value,
                );
                if (next) setFormat(next);
              }}
            >
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label>
            Default additional actions
            <input
              type="number"
              required
              min={1}
              max={maxSteps}
              value={steps ?? defaults.pageSteps}
              onChange={(event) => setSteps(event.target.value)}
            />
          </label>
          <label>
            Default delay (ms)
            <input
              type="number"
              required
              min={minDelay}
              max={maxDelay}
              value={delay ?? defaults.pageDelay}
              onChange={(event) => setDelay(event.target.value)}
            />
          </label>
        </div>
        <label className="export-check library-pref">
          <input
            type="checkbox"
            checked={dedupe ?? defaults.deduplicate}
            onChange={(event) => setDedupe(event.target.checked)}
          />{" "}
          Remove exact duplicates from new single-page captures
        </label>
        <button
          type="submit"
          className="button button--outline"
          disabled={!isSettings(paging) || library.busy || library.loading}
        >
          Save workflow defaults
        </button>
      </form>
    </section>
  );
}
function ConfigurationExchange({ library }: { library: LibraryView }) {
  const [pending, setPending] = useState<PortableConfiguration | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  return (
    <details className="export-panel">
      <summary>Import configuration</summary>
      <div className="library-tools">
        <p className="export-note">
          Select a SCRAPNEXS configuration JSON file, review its site and name,
          then confirm. A file never grants page access or runs a capture.
        </p>
        <label>
          Configuration JSON file{" "}
          <input
            type="file"
            accept=".json,application/json"
            disabled={library.busy}
            onChange={(event) => {
              const current = ++generation.current;
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              setPending(null);
              setError("");
              if (!file) return;
              if (file.size > configurationFileLimit) {
                setError("Configuration files must be 24 KiB or smaller.");
                return;
              }
              void file
                .arrayBuffer()
                .then((bytes) => {
                  let text: string;
                  try {
                    text = new TextDecoder("utf-8", { fatal: true }).decode(
                      bytes,
                    );
                  } catch {
                    throw new Error("Configuration files must use UTF-8.");
                  }
                  const next = decodeConfiguration(text);
                  if (current === generation.current) setPending(next);
                })
                .catch((problem: unknown) => {
                  if (current === generation.current)
                    setError(
                      problem instanceof Error
                        ? problem.message
                        : "Could not read the configuration file.",
                    );
                });
            }}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        {pending && (
          <div className="library-list">
            <p>
              Review “{pending.name}” · {pending.origin} · {pending.kind}
            </p>
            <p>
              Fields:{" "}
              {readSchema(pending.signature, pending.kind)
                ?.map(([, label, type]) => `${label || "Unnamed"} (${type})`)
                .join(", ")}
            </p>
            <div className="library-actions">
              <button
                type="button"
                className="button button--outline"
                disabled={
                  library.busy ||
                  library.loading ||
                  library.recipes.length >= maxRecipes
                }
                onClick={() => {
                  library.importConfiguration(pending);
                  setPending(null);
                }}
              >
                Confirm configuration import
              </button>
              <button
                type="button"
                className="button button--outline"
                onClick={() => setPending(null)}
              >
                Cancel import
              </button>
            </div>
            {library.recipes.length >= maxRecipes && (
              <p>Delete a saved configuration before importing another.</p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
export function HistoryPanel({
  library,
  blocked,
  restore,
  report,
  origin,
  useCandidate,
}: {
  library: LibraryView;
  blocked: boolean;
  restore: (item: SavedSession) => boolean;
  report: PageDetection | null;
  origin: string | null;
  useCandidate: (candidate: DetectedCandidate) => void;
}) {
  const [downloadNote, setDownloadNote] = useState("");
  return (
    <section
      className="panel library-panel"
      aria-label="Local history and configurations"
    >
      <header className="card-head">
        <div className="card-lead">
          <span className="section-icon">
            <Archive size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>Local library</h2>
            <p>Only items you save appear here.</p>
          </div>
        </div>
        <button
          className="button button--outline"
          type="button"
          disabled={library.busy}
          onClick={library.refresh}
        >
          Refresh library
        </button>
      </header>
      <Usage library={library} />
      {library.loading && (
        <p className="settings-copy" role="status">
          Checking local storage…
        </p>
      )}
      <div className="library-list">
        <h3>Saved snapshots</h3>
        {blocked && (
          <p className="export-note">
            Finish or discard the current working copy before restoring another.
          </p>
        )}
        {!library.loading && !library.sessions.length && (
          <p className="export-note">No saved snapshots yet.</p>
        )}
        <ul>
          {library.sessions.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>
                  {item.rows.toLocaleString()} rows · {item.columns} columns
                  {item.partial ? " · partial capture" : ""} ·{" "}
                  {new Date(item.savedAt).toLocaleString()}
                </p>
              </div>
              <div className="library-actions">
                <button
                  type="button"
                  className="button button--outline"
                  disabled={blocked || library.busy}
                  aria-label={`Restore ${item.name}`}
                  onClick={() => library.restore(item.id, restore)}
                >
                  <FolderOpen size={14} aria-hidden="true" />
                  Restore
                </button>
                <button
                  type="button"
                  className="button button--outline"
                  disabled={library.busy}
                  aria-label={`Delete snapshot ${item.name}`}
                  onClick={() => {
                    if (confirm(`Delete saved snapshot “${item.name}”?`))
                      library.remove(item.id);
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="library-list">
        <h3>Saved configurations</h3>
        <ConfigurationExchange library={library} />
        {downloadNote && <p role="status">{downloadNote}</p>}
        <p className="export-note">
          Analyze a page on the same site first. A matching configuration can
          select its structure, but will not collect or navigate.
        </p>
        {!library.loading && !library.recipes.length && (
          <p className="export-note">No saved configurations yet.</p>
        )}
        <ul>
          {library.recipes.map((item) => {
            const match = configurationMatch(item, origin, report);
            const found = "candidate" in match ? match.candidate : undefined;
            const reason = {
              site: "Open and analyze a page on this site.",
              scan: "Run a complete analysis first.",
              none: "No compatible structure found.",
              ambiguous: "Several structures match. Choose one manually.",
              exact: "Exact schema match.",
              compatible:
                "Matching field labels and types; review the new column order.",
            }[match.status];
            return (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.origin} · {item.kind}
                  </p>
                  <p>{reason}</p>
                </div>
                <div className="library-actions">
                  <button
                    type="button"
                    className="button button--outline"
                    disabled={!found || library.busy}
                    aria-label={`Use configuration ${item.name}`}
                    onClick={() => {
                      if (found) useCandidate(found);
                    }}
                  >
                    Use configuration
                  </button>
                  <button
                    type="button"
                    className="button button--outline"
                    aria-label={`Download configuration ${item.name}`}
                    onClick={() => {
                      try {
                        requestDownload(
                          new Blob([encodeConfiguration(item)], {
                            type: "application/json;charset=utf-8",
                          }),
                          "scrapnexs-configuration.json",
                        );
                        setDownloadNote("Configuration download requested.");
                      } catch {
                        setDownloadNote(
                          "This configuration could not be downloaded.",
                        );
                      }
                    }}
                  >
                    Download JSON
                  </button>
                  <button
                    type="button"
                    className="button button--outline"
                    disabled={library.busy}
                    aria-label={`Delete configuration ${item.name}`}
                    onClick={() => {
                      if (confirm(`Delete saved configuration “${item.name}”?`))
                        library.removeRecipe(item.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
