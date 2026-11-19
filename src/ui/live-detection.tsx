import { ScanLine, Table2 } from "lucide-react";
import {
  candidateLabels,
  type DetectedCandidate,
  type PageDetection,
} from "../core/detector/contracts";

export interface DetectionView {
  origin: string | null;
  state: "idle" | "running" | "ready" | "error";
  report: PageDetection | null;
  scan: () => void;
}

export function LiveCandidates({
  view,
  selected,
  onSelect,
}: {
  view: DetectionView;
  selected?: string | undefined;
  onSelect: (id: string) => void;
}) {
  const candidates = view.report?.candidates ?? [];
  return (
    <section
      className="panel candidate-panel"
      aria-label="Candidate structures"
    >
      <header className="card-head">
        <div className="card-lead">
          <span className="section-icon">
            <ScanLine size={19} aria-hidden="true" />
          </span>
          <div>
            <h2>Detected structures</h2>
            <p>Ranked candidates on the authorized page</p>
          </div>
        </div>
        <span className="count-tag">{candidates.length} found</span>
      </header>
      {candidates.length ? (
        <fieldset className="candidate-list">
          <legend className="sr-only">Select a detected structure</legend>
          {candidates.map((candidate, index) => (
            <label className="candidate" key={candidate.id}>
              <input
                type="radio"
                name="detected-candidate"
                checked={selected === candidate.id}
                onChange={() => onSelect(candidate.id)}
              />
              <span className="candidate-title">
                <span>
                  {candidateLabels[candidate.kind]} {index + 1}
                </span>
                <span className="radio-dot" aria-hidden="true" />
              </span>
              <span className="candidate-meta">
                {candidate.sampled
                  ? `About ${candidate.estimate}`
                  : candidate.observed}{" "}
                rows · {candidate.columns.length} columns
              </span>
              <span
                className={`match-tag${candidate.score >= 76 ? " match-tag--strong" : ""}`}
              >
                <span aria-hidden="true" />{" "}
                {candidate.score >= 76
                  ? "Strong"
                  : candidate.score >= 53
                    ? "Possible"
                    : "Weak"}{" "}
                match · {candidate.score}/100
              </span>
              <span className="candidate-hint">
                {candidate.explanations[0]}
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="empty-state">
          <ScanLine size={24} aria-hidden="true" />
          <strong>
            {view.state === "running"
              ? "Analyzing the page…"
              : view.report?.status === "changed"
                ? "The page changed"
                : "No candidates yet"}
          </strong>
          <p>
            {view.report?.status === "changed"
              ? "Wait for the page to settle, then analyze it again."
              : view.state === "ready"
                ? "No supported table or repeated listing was detected in that scan."
                : view.origin
                  ? "Analyze this page to look for tables and repeated listings."
                  : "Open the toolbar popup on a supported webpage to grant temporary access, or try sample data."}
          </p>
        </div>
      )}
    </section>
  );
}

export function LivePreview({
  candidate,
}: {
  candidate?: DetectedCandidate | undefined;
}) {
  return (
    <section className="panel data-panel" aria-label="Data preview">
      <header className="card-head">
        <div className="card-lead">
          <span className="section-icon">
            <Table2 size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>Data preview</h2>
            <p>
              {candidate
                ? "A limited, read-only preview from this page"
                : "Review the first observed values"}
            </p>
          </div>
        </div>
        {candidate && (
          <span className="count-tag">
            {candidate.rows.length} preview rows
          </span>
        )}
      </header>
      {candidate ? (
        <>
          <div
            className="table-scroll live-table"
            tabIndex={0}
            role="region"
            aria-label="Detected records table (scroll horizontally if needed)"
          >
            <table>
              <caption className="sr-only">
                {candidateLabels[candidate.kind]} preview
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  {candidate.columns.map((column) => (
                    <th key={column.id} scope="col">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidate.rows.map((row, index) => (
                  <tr key={index}>
                    <th scope="row">{index + 1}</th>
                    {row.map((text, offset) => (
                      <td key={offset}>
                        {text ?? <span aria-label="Missing value">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="match-reasons">
            <summary>Why this structure was ranked</summary>
            <ul>
              {candidate.explanations.map((explanation, index) => (
                <li key={index}>{explanation}</li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <div className="empty-state">
          <Table2 size={26} aria-hidden="true" />
          <strong>No records to preview</strong>
          <p>Choose a detected structure or explore the built-in sample.</p>
        </div>
      )}
    </section>
  );
}
