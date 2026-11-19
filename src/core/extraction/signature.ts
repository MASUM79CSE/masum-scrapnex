import type { DetectedCandidate } from "../detector/contracts";
export function candidateSignature(candidate: DetectedCandidate) {
  return JSON.stringify([
    candidate.id,
    candidate.kind,
    candidate.estimate,
    candidate.columns.map(({ id, label, kind }) => [id, label, kind]),
    candidate.rows,
  ]);
}

export function schemaSignature(candidate: DetectedCandidate) {
  return JSON.stringify([
    candidate.kind,
    candidate.columns.map(({ id, label, kind }) => [id, label, kind]),
  ]);
}
