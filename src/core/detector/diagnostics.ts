import { candidateLabels, type Kind, type PageDetection } from "./contracts";
export interface ExtractionDiagnostics {
  version: 1;
  status: PageDetection["status"];
  candidateCount: number;
  candidates: Array<{
    kind: Kind;
    score: number;
    observed: number;
    estimate: number;
    previewRows: number;
    columns: number;
    blank: number;
    missing: number;
    sampled: boolean;
  }>;
}
// Allowlist-only: no DOM text, column labels, row values, URLs, selectors or IDs.
export function extractionDiagnostics(
  report: PageDetection,
): ExtractionDiagnostics {
  return {
    version: 1,
    status: report.status,
    candidateCount: report.candidates.length,
    candidates: report.candidates.map((candidate) => ({
      kind: candidate.kind,
      score: candidate.score,
      observed: candidate.observed,
      estimate: candidate.estimate,
      sampled: candidate.sampled,
      previewRows: candidate.rows.length,
      columns: candidate.columns.length,
      blank: candidate.rows.reduce(
        (sum, row) => sum + row.filter((cell) => cell === "").length,
        0,
      ),
      missing: candidate.rows.reduce(
        (sum, row) => sum + row.filter((cell) => cell === null).length,
        0,
      ),
    })),
  };
}
export const diagnosticKind = (kind: Kind) => candidateLabels[kind];
