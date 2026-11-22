import { Component, type ErrorInfo, type ReactNode } from "react";
import { PRODUCT_VERSION } from "../data/contracts";

type State = { error: Error | null; copied: boolean };

function describe(error: Error): string {
  // Deliberately excludes stacks and any page-derived data.
  return [
    `version: ${PRODUCT_VERSION}`,
    `error: ${error.name}: ${error.message}`.slice(0, 300),
    `surface: ${typeof location === "undefined" ? "unknown" : location.pathname}`,
    `time: ${new Date().toISOString()}`,
  ].join("\n");
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Local console only: no page content, no network egress, no telemetry.
    console.error(
      "SCRAPNEXS_UI_ERROR",
      error.name,
      error.message,
      info.componentStack?.slice(0, 400) ?? "",
    );
  }

  override render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash-card" role="alert" aria-live="assertive">
        <h1>Something went wrong in this view</h1>
        <p>
          Your collected data is safe: the working copy lives in memory until
          you save it, and saved snapshots are untouched. Reloading rebuilds the
          view from what is stored locally.
        </p>
        <p className="crash-detail">
          {error.name}: {error.message}
        </p>
        <div className="library-actions">
          <button
            type="button"
            className="button"
            onClick={() => window.location.reload()}
          >
            Reload this view
          </button>
          <button
            type="button"
            className="button button--outline"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(describe(error))
                .then(() => this.setState({ copied: true }))
                .catch(() => this.setState({ copied: false }));
            }}
          >
            Copy error details
          </button>
        </div>
        <p aria-live="polite">
          {copied
            ? "Copied. Details contain the error message and version only — no page content."
            : "Details never include page content, selectors or collected values."}
        </p>
      </div>
    );
  }
}
