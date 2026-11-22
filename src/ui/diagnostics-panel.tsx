import { useState } from "react";
import { requestDownload } from "../browser/export";
import type { PageDetection } from "../core/detector/contracts";
import {
  diagnosticKind,
  extractionDiagnostics,
} from "../core/detector/diagnostics";

export function DiagnosticsPanel({ report }: { report: PageDetection }) {
  const [message, setMessage] = useState("");
  const details = extractionDiagnostics(report);
  return (
    <details className="export-panel diagnostics-panel">
      <summary>Extraction diagnostics</summary>
      <div className="library-list">
        <p className="export-note">
          Scan {details.status} · {details.candidateCount} candidates. Download
          contains counts and ranking signals only, not page addresses or
          content.
        </p>
        <ol>
          {details.candidates.map((candidate, index) => (
            <li key={index}>
              <div>
                <strong>
                  {diagnosticKind(candidate.kind)} · Score {candidate.score}/100
                </strong>
                <p>
                  {candidate.observed} observed · {candidate.estimate} estimated
                  · {candidate.columns} columns
                  {candidate.sampled ? " · sampled" : ""}
                </p>
                <p>
                  {candidate.previewRows} preview rows · {candidate.missing}{" "}
                  missing · {candidate.blank} blank cells
                </p>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="button button--outline"
          onClick={() => {
            try {
              requestDownload(
                new Blob([JSON.stringify(details, null, 2) + "\n"], {
                  type: "application/json;charset=utf-8",
                }),
                "scrapnexs-extraction-diagnostics.json",
              );
              setMessage("Diagnostics download requested.");
            } catch {
              setMessage("Could not start the diagnostics download.");
            }
          }}
        >
          Download diagnostics
        </button>
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
