import { scanForDetection } from "../analyzer";
import { detectCollection } from "./collections";
import {
  changedPage,
  maxStructures,
  type DetectedCandidate,
  type PageDetection,
} from "./contracts";
import { rankCandidates } from "./rank";
import { detectTable, tableRecords } from "./tables";
import type { RowPlan } from "../extraction/collect";

export async function detectPage(doc: Document): Promise<PageDetection> {
  return (await findPlans(doc)).report;
}
export async function findPlans(
  doc: Document,
): Promise<{ report: PageDetection; plans: ReadonlyMap<string, RowPlan> }> {
  const start = performance.now();
  const view = doc.defaultView;
  const plans = new Map<string, RowPlan>();
  if (!view || !doc.body)
    return {
      report: { version: 1, status: "complete", candidates: [], notes: [] },
      plans,
    };
  const url = view.location.href;
  const snapshot = await scanForDetection(doc);
  if (snapshot.analysis.reason === "dom-changed" || view.location.href !== url)
    return { report: changedPage(), plans };
  const candidates: DetectedCandidate[] = [];
  const tableOf = new Map<string, HTMLTableElement>();
  let limited = false;
  for (const [index, table] of snapshot.tables.entries()) {
    if (performance.now() - start >= 1_800) {
      limited = true;
      break;
    }
    if (table.closest('nav, [role="navigation"], footer')) continue;
    const candidate = detectTable(table, index, view);
    if (!candidate) continue;
    candidates.push(candidate);
    tableOf.set(candidate.id, table);
    let clipped = false;
    plans.set(candidate.id, {
      columns: candidate.columns,
      rows: tableRecords(table, view, candidate.columns.length, () => {
        clipped = true;
      }),
      clipped: () => clipped,
    });
  }
  for (const group of snapshot.analysis.candidates) {
    if (performance.now() - start >= 1_800) {
      limited = true;
      break;
    }
    const plan = detectCollection(
      group,
      snapshot.members.get(group.id) ?? [],
      view,
      doc.baseURI,
    );
    const members = snapshot.enumerators.get(group.id);
    if (!plan || !members) continue;
    candidates.push(plan.candidate);
    plans.set(plan.candidate.id, {
      columns: plan.candidate.columns,
      rows: (function* () {
        for (const element of members())
          yield element ? plan.read(element) : null;
      })(),
    });
  }
  const notes: string[] = [];
  if (snapshot.analysis.status !== "complete")
    notes.push(
      "The scan reached a resource limit; only part of the page was analyzed.",
    );
  if (limited || snapshot.tableLimitReached)
    notes.push(
      "A preview or table limit was reached; other structures may be available.",
    );
  if (candidates.length > maxStructures)
    notes.push(`Showing the ${maxStructures} highest-ranked structures.`);
  if (candidates.length)
    notes.push(
      "Previews contain up to six observed rows. A match score is a heuristic, not a guarantee.",
    );
  // A table nested inside another detected table is part of its parent's records
  // (a nested grid, a layout cell). Keep it as an alternative, never as the primary
  // suggestion, so ranking cannot promote inner content over the record structure.
  const nested = new Set(
    [...tableOf].flatMap(([id, table]) => {
      for (
        let ancestor = table.parentElement?.closest("table");
        ancestor;
        ancestor = ancestor.parentElement?.closest("table")
      )
        if ([...tableOf.values()].includes(ancestor)) return [id];
      return [];
    }),
  );
  const ordered = rankCandidates(candidates);
  const ranked = [
    ...ordered.filter(({ id }) => !nested.has(id)),
    ...ordered.filter(({ id }) => nested.has(id)),
  ].slice(0, maxStructures);
  return {
    report: {
      version: 1,
      status:
        limited ||
        snapshot.tableLimitReached ||
        snapshot.analysis.status !== "complete"
          ? "partial"
          : "complete",
      candidates: ranked,
      notes,
    },
    plans,
  };
}
