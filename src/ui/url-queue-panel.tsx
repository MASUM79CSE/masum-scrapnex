import { useState } from "react";
import type { UrlQueueView } from "../browser/use-url-queue";
import { maxQueuedPages, maxQueueText } from "../browser/url-queue";

export function UrlQueuePanel({
  queue,
  locked,
}: {
  queue: UrlQueueView;
  locked: boolean;
}) {
  const [input, setInput] = useState("");
  const item = queue.first;
  const status = {
    pending: "Waiting",
    opened: "Opened · waiting for capture",
    collected: "Collected",
    partial: "Partial capture",
    skipped: "Skipped",
  };
  return (
    <details className="export-panel url-queue-panel">
      <summary>Multi-URL queue</summary>
      <form
        className="library-tools"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            queue.entries.length &&
            !confirm(
              "Replace this queue? Open tabs and saved snapshots will not be changed.",
            )
          )
            return;
          queue.load(input);
        }}
      >
        <p>
          Review up to {maxQueuedPages} pages. Preparing the queue does not open
          pages or grant access. URLs stay in memory and are not included in
          diagnostics.
        </p>
        <label>
          One absolute HTTP(S) URL per line
          <textarea
            value={input}
            maxLength={maxQueueText}
            rows={3}
            required
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="button button--outline"
          disabled={queue.busy || locked || !input.trim()}
        >
          Prepare URL queue
        </button>
      </form>
      {queue.error && <p role="alert">{queue.error}</p>}
      {!!queue.entries.length && (
        <div className="library-list">
          <p>
            Open one page at a time. Use the toolbar popup on that tab to grant
            temporary access, then Analyze page and Collect records. Save or
            export the working copy before discarding it to proceed. A
            redirected page does not complete an entry.
          </p>
          <ol>
            {queue.entries.map((entry) => (
              <li key={entry.href}>
                <div>
                  <strong>{entry.href}</strong>
                  <p>{status[entry.status]}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="library-actions">
            {item?.status === "pending" && (
              <button
                type="button"
                className="button button--outline"
                disabled={locked || queue.busy}
                onClick={() => void queue.openNext(item.href)}
              >
                Open next queued page
              </button>
            )}
            {item?.status === "opened" && (
              <button
                type="button"
                className="button button--outline"
                disabled={locked || queue.busy}
                onClick={() => queue.mark(item.href, true)}
              >
                Return page to queue
              </button>
            )}
            {item && (
              <button
                type="button"
                className="button button--outline"
                disabled={locked || queue.busy}
                onClick={() => queue.mark(item.href, false)}
              >
                Skip queued page
              </button>
            )}
            <button
              type="button"
              className="button button--outline"
              disabled={queue.busy || locked}
              onClick={() => {
                if (
                  confirm(
                    "Clear the in-memory queue? Open tabs and saved snapshots will not be changed.",
                  )
                ) {
                  queue.clear();
                  setInput("");
                }
              }}
            >
              Clear URL queue
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
