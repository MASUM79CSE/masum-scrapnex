import type { DetectedCandidate, Kind } from "./contracts";

/**
 * Evidence-based ranking.
 *
 * Per-structure detectors produce a base score from their own heuristics. Those scores are
 * not comparable across kinds (a table score and a card score are computed from different
 * signals), so the final ordering here is deliberately explicit: base score, structural
 * evidence from the bounded preview, and a penalty for navigation/site-chrome content.
 *
 * Everything is computed from the already-bounded `DetectedCandidate`, so ranking stays
 * deterministic, offline, and independent of page size.
 */

const chromePhrases = [
  /^sign ?in$/iu,
  /^log ?in$/iu,
  /^log ?out$/iu,
  /^register$/iu,
  /^create (an )?account$/iu,
  /^privacy( policy)?$/iu,
  /^cookie(s| settings)?$/iu,
  /^about( us)?$/iu,
  /^careers?$/iu,
  /^jobs?$/iu,
  /^terms( of (use|service))?$/iu,
  /^advertisement$/iu,
  /^sponsored$/iu,
  /^subscribe.*$/iu,
  /^download (our )?app$/iu,
  /^home$/iu,
  /^contact( us)?$/iu,
  /^help$/iu,
  /^faq$/iu,
  /^next ?page$/iu,
  /^previous ?page$/iu,
];

const kindPrior: Record<Kind, number> = {
  products: 1,
  articles: 1,
  directory: 1,
  table: 0.95,
  cards: 0.7,
  list: 0.6,
};

const genericLabel = /^(column \d+|text|link|image url|value)$/iu;

export interface Evidence {
  /** Share of preview cells that hold a value. */
  fill: number;
  /** Share of distinct values in the first column (repeated chrome drags this down). */
  distinct: number;
  /** Share of typed columns (URL or image), which indicate real record fields. */
  typed: number;
  /** Share of columns with a meaningful, non-placeholder label. */
  labelled: number;
  /** Share of preview rows that look like site chrome rather than records. */
  chrome: number;
  /** Combined 0–1 evidence strength. */
  strength: number;
  /** Final ranking score, 0–100. */
  score: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function evidenceFor(candidate: DetectedCandidate): Evidence {
  const cells = candidate.rows.flat();
  const filled = cells.filter(
    (cell) => typeof cell === "string" && cell.trim().length > 0,
  ).length;
  const fill = cells.length ? filled / cells.length : 0;

  const firsts = candidate.rows
    .map((row) => (row[0] ?? "").trim())
    .filter(Boolean);
  const distinct = firsts.length
    ? new Set(firsts.map((value) => value.toLowerCase())).size / firsts.length
    : 0;

  const typedColumns = candidate.columns.filter(
    (column) => column.kind !== "text",
  ).length;
  const typed = candidate.columns.length
    ? typedColumns / candidate.columns.length
    : 0;

  const labelledColumns = candidate.columns.filter(
    (column) => !genericLabel.test(column.label.trim()),
  ).length;
  const labelled = candidate.columns.length
    ? labelledColumns / candidate.columns.length
    : 0;

  const chromeRow = candidate.rows.filter((row) =>
    row.some(
      (cell) =>
        typeof cell === "string" &&
        chromePhrases.some((phrase) => phrase.test(cell.trim())),
    ),
  ).length;
  const chrome = candidate.rows.length ? chromeRow / candidate.rows.length : 0;

  const prior = kindPrior[candidate.kind] ?? 0.5;
  const strength =
    clamp(
      (0.3 * fill + 0.25 * distinct + 0.2 * typed + 0.25 * labelled) *
        100 *
        prior,
    ) / 100;

  // Base score stays dominant; evidence refines and chrome content penalises.
  const score = clamp(
    0.6 * candidate.score + 0.4 * strength * 100 - 35 * chrome,
  );

  return { fill, distinct, typed, labelled, chrome, strength, score };
}

/**
 * Orders candidates for presentation. Stable for equal scores, and it never mutates input.
 */
export function rankCandidates(
  candidates: readonly DetectedCandidate[],
): DetectedCandidate[] {
  const scored = candidates.map((candidate, index) => ({
    candidate,
    index,
    evidence: evidenceFor(candidate),
  }));
  scored.sort(
    (a, b) =>
      b.evidence.score - a.evidence.score ||
      b.candidate.score - a.candidate.score ||
      Number(b.candidate.kind === "table") -
        Number(a.candidate.kind === "table") ||
      b.candidate.observed - a.candidate.observed ||
      a.index - b.index,
  );
  return scored.map(({ candidate, evidence }) => ({
    ...candidate,
    score: evidence.score,
    explanations: [
      ...candidate.explanations,
      `Ranked ${evidence.chrome > 0.34 ? "lower" : "on"} structural evidence: ${Math.round(evidence.fill * 100)}% filled preview, ${Math.round(evidence.distinct * 100)}% distinct first values, ${Math.round(evidence.labelled * 100)}% named columns.`,
    ].slice(0, 10),
  }));
}
