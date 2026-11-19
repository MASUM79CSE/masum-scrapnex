import type { Column } from "../detector/contracts";
import {
  maxDatasetRows,
  maxDatasetUnits,
  normalizeCell,
  type Cell,
  type CollectionResult,
  type RecordRow,
} from "./contracts";

export interface RowPlan {
  columns: Column[];
  clipped?: () => boolean;
  rows: Iterable<readonly Cell[] | null>;
}
export const changedCollection = (): CollectionResult => ({
  version: 1,
  status: "changed",
  note: "The page changed during collection. Analyze or pick the rows again.",
});
export const unavailableCollection = (): CollectionResult => ({
  version: 1,
  status: "unavailable",
  note: "The selected structure is no longer available. Analyze or pick the rows again.",
});

/** Delivers an atomic, locally bounded snapshot rather than handing partially stale rows to the UI. */
export async function collectRows(
  doc: Document,
  plan: RowPlan,
  expectedUrl: string,
  knownPartial = false,
  signal?: AbortSignal,
): Promise<CollectionResult> {
  const view = doc.defaultView;
  if (!view || signal?.aborted || view.location.href !== expectedUrl)
    return changedCollection();
  let dirty = false;
  const observer = new MutationObserver(() => {
    dirty = true;
  });
  observer.observe(doc.documentElement, {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true,
  });
  const channel = new MessageChannel();
  const pause = () =>
    new Promise<void>((resolve) => {
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(0);
    });
  const changed = () =>
    signal?.aborted ||
    dirty ||
    observer.takeRecords().length > 0 ||
    view.location.href !== expectedUrl;
  const start = performance.now();
  const rows: RecordRow[] = [];
  let units = 0;
  let steps = 0;
  let cap = false;
  try {
    for (const item of plan.rows) {
      if (changed()) return changedCollection();
      if (++steps > 50_000 || performance.now() - start > 4_000) {
        cap = true;
        break;
      }
      if (steps % 24 === 0) {
        await pause();
        if (changed()) return changedCollection();
      }
      if (item === null) continue;
      if (rows.length >= maxDatasetRows) {
        cap = true;
        break;
      }
      const cells = plan.columns.map((col, index) =>
        normalizeCell(item[index] ?? null, col.kind),
      );
      units += cells.reduce(
        (sum, cell) => sum + Math.max(1, cell?.length ?? 0),
        0,
      );
      if (units > maxDatasetUnits) {
        cap = true;
        break;
      }
      rows.push({ id: `r${rows.length + 1}`, cells });
    }
    if (changed()) return changedCollection();
    const partial = cap || knownPartial || plan.clipped?.();
    return {
      version: 1,
      status: partial ? "partial" : "complete",
      dataset: { version: 1, columns: plan.columns, rows },
      note: partial
        ? "Partial capture: a page-analysis, row, field-data or time limit was reached."
        : "Captured from the current page only. Changes are held in memory.",
    };
  } finally {
    observer.disconnect();
    channel.port1.close();
    channel.port2.close();
  }
}
