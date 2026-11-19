import type { WorkflowDefaults } from "../core/library/contracts";
import { ArrowRight, Layers, Pause, Play, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PaginationView } from "../browser/use-pagination";
import {
  isSettings,
  linked,
  maxDelay,
  maxSteps,
  minDelay,
  type Mode,
} from "../core/pagination/contracts";
const labels: Record<Mode, string> = {
  next: "Next-page link",
  numbered: "Numbered pagination",
  url: "Incrementing page URL",
  more: "Load More button",
  scroll: "Incremental viewport scroll",
};
export function PaginationPanel({
  view,
  blocked,
  defaults,
}: {
  view: PaginationView;
  blocked: boolean;
  defaults?: WorkflowDefaults | undefined;
}) {
  const [selected, setSelected] = useState("0"),
    [steps, setSteps] = useState<string | null>(null),
    [delay, setDelay] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const review = view.review;
  const showing = !!review;
  useEffect(() => {
    if (showing) heading.current?.focus();
  }, [showing]);
  const action = review?.actions[Number(selected)];
  const options = {
    steps: Number(steps ?? defaults?.pageSteps ?? 3),
    delay: Number(delay ?? defaults?.pageDelay ?? 1000),
  };
  if (!review && !view.progress && !view.error && !view.busy) return null;
  return (
    <section
      className="panel pagination-panel"
      aria-label="Multi-page collection"
    >
      <header className="card-head">
        <div className="card-lead">
          <span className="section-icon">
            <Layers size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 ref={heading} tabIndex={-1}>
              Multi-page collection
            </h2>
            <p>Only the reviewed action type on this authorized tab.</p>
          </div>
        </div>
        {!view.busy && (
          <button
            type="button"
            className="button button--outline"
            onClick={() => {
              view.close();
              setSelected("0");
              setSteps(null);
              setDelay(null);
            }}
          >
            <X size={14} aria-hidden="true" />
            Close pagination
          </button>
        )}
      </header>
      {view.error && (
        <p role="alert" className="pagination-note">
          {view.error}
        </p>
      )}
      {view.busy && !review && !view.progress && (
        <p role="status" className="pagination-note">
          Inspecting the page without interacting with it…
        </p>
      )}
      {review && (
        <form
          className="pagination-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!blocked && action && isSettings(options)) {
              setSelected("0");
              setSteps(null);
              setDelay(null);
              view.start(action, options);
            }
          }}
        >
          {!review.actions.length ? (
            <p>No supported pagination or loading control was found.</p>
          ) : (
            <>
              <label>
                Action to authorize
                <select
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {review.actions.map((item, index) => (
                    <option key={index} value={index}>
                      {labels[item.mode]} — {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {action && (
                <p className="pagination-destination">
                  {linked(action) ? (
                    <>
                      First destination: <code>{action.href}</code>
                    </>
                  ) : (
                    <>
                      Interaction shown on page: <strong>{action.label}</strong>
                    </>
                  )}
                </p>
              )}
              <div className="pagination-actions">
                <label>
                  Maximum additional actions
                  <input
                    type="number"
                    min={1}
                    max={maxSteps}
                    required
                    value={steps ?? defaults?.pageSteps ?? 3}
                    onChange={(event) => setSteps(event.target.value)}
                  />
                </label>
                <label>
                  Minimum delay (ms)
                  <input
                    type="number"
                    min={minDelay}
                    max={maxDelay}
                    step={1}
                    required
                    value={delay ?? defaults?.pageDelay ?? 1000}
                    onChange={(event) => setDelay(event.target.value)}
                  />
                </label>
              </div>
              <p>
                You are allowing up to{" "}
                {isSettings(options) ? options.steps : maxSteps} actions of this
                type. Keep the source tab active. The current page is collected
                first; exact duplicate rows are skipped.
              </p>
              <button
                type="submit"
                className="button button--primary"
                disabled={blocked || !action || !isSettings(options)}
              >
                Authorize and start <ArrowRight size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </form>
      )}
      {view.progress && (
        <div className="pagination-form">
          <p role="status">
            <strong>
              {view.progress.status === "recovery"
                ? "Review needed"
                : view.progress.status.charAt(0).toUpperCase() +
                  view.progress.status.slice(1)}
            </strong>{" "}
            · {view.progress.steps} actions · {view.progress.snapshots} verified
            snapshots · {view.progress.rows.toLocaleString()} rows ·{" "}
            {view.progress.duplicates.toLocaleString()} duplicates skipped
          </p>
          <p className="pagination-note">{view.progress.note}</p>
          {view.busy && (
            <div className="pagination-actions">
              {view.progress.status === "working" && (
                <button
                  type="button"
                  className="button button--outline"
                  onClick={view.pause}
                >
                  <Pause size={14} aria-hidden="true" />
                  Pause run
                </button>
              )}
              {(view.progress.status === "paused" ||
                view.progress.status === "pausing") && (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={view.resume}
                >
                  <Play size={14} aria-hidden="true" />
                  Resume run
                </button>
              )}
              <button
                type="button"
                className="button button--outline"
                onClick={view.stop}
              >
                <Square size={14} aria-hidden="true" />
                Stop run
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
