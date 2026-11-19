import { scanForDetection } from "../analyzer";
import { detectCollection } from "./collections";
import {
  changedPage,
  maxStructures,
  type DetectedCandidate,
  type PageDetection,
} from "./contracts";
import { detectTable } from "./tables";

export async function detectPage(doc: Document): Promise<PageDetection> {
  const start = performance.now();
  const view = doc.defaultView;
  const empty = {
    version: 1,
    status: "complete",
    candidates: [],
    notes: [],
  } satisfies PageDetection;
  if (!view || !doc.body) return empty;
  const url = view.location.href;
  const snapshot = await scanForDetection(doc);
  if (snapshot.analysis.reason === "dom-changed" || view.location.href !== url)
    return changedPage();
  const candidates: DetectedCandidate[] = [];
  let previewLimited = false;
  for (const [index, table] of snapshot.tables.entries()) {
    if (performance.now() - start >= 1_800) {
      previewLimited = true;
      break;
    }
    if (table.closest('nav, [role="navigation"], footer')) continue;
    const result = detectTable(table, index, view);
    if (result) candidates.push(result);
  }
  for (const group of snapshot.analysis.candidates) {
    if (performance.now() - start >= 1_800) {
      previewLimited = true;
      break;
    }
    const result = detectCollection(
      group,
      snapshot.members.get(group.id) ?? [],
      view,
      doc.baseURI,
    );
    if (result) candidates.push(result);
  }
  const notes: string[] = [];
  if (snapshot.analysis.status !== "complete")
    notes.push(
      "The scan reached a resource limit; only part of the page was analyzed.",
    );
  if (previewLimited || snapshot.tableLimitReached)
    notes.push(
      "A preview or table limit was reached; other structures may be available.",
    );
  if (candidates.length > maxStructures)
    notes.push(`Showing the ${maxStructures} highest-ranked structures.`);
  if (candidates.length)
    notes.push(
      "Previews contain up to six observed rows. A match score is a heuristic, not a guarantee.",
    );
  const ranked = candidates.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.kind === "table") - Number(a.kind === "table") ||
      b.observed - a.observed,
  );
  return {
    version: 1,
    status:
      previewLimited ||
      snapshot.tableLimitReached ||
      snapshot.analysis.status !== "complete"
        ? "partial"
        : "complete",
    candidates: ranked.slice(0, maxStructures),
    notes,
  };
}
