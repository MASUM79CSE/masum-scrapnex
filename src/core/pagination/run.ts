import {
  maxDatasetRows,
  maxDatasetUnits,
  type Dataset,
  type CollectionResult,
} from "../extraction/contracts";
import {
  isSettings,
  linked,
  maxRunMs,
  type Action,
  type DynamicAction,
  type LinkAction,
  type Settings,
} from "./contracts";
export type Status =
  "working" | "pausing" | "paused" | "complete" | "stopped" | "recovery";
export interface Progress {
  status: Status;
  steps: number;
  snapshots: number;
  rows: number;
  note: string;
  duplicates: number;
}
export interface Cursor {
  href: string;
  documentId: string;
}
export interface Adapter {
  inspect(cursor: Cursor, signal: AbortSignal): Promise<Action[]>;
  read(
    cursor: Cursor,
    initial: boolean,
    signal: AbortSignal,
  ): Promise<CollectionResult>;
  navigate(
    cursor: Cursor,
    action: LinkAction,
    signal: AbortSignal,
  ): Promise<Cursor>;
  interact(
    cursor: Cursor,
    action: DynamicAction,
    delay: number,
    signal: AbortSignal,
  ): Promise<boolean>;
  wait(ms: number, signal: AbortSignal): Promise<void>;
}
export interface RunResult {
  dataset: Dataset | null;
  progress: Progress;
}
const units = (value: string | null) => Math.max(1, value?.length ?? 0);
export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export function startRun(
  initial: Cursor,
  approved: Action,
  settings: Settings,
  port: Adapter,
  report: (state: Progress) => void,
) {
  if (!isSettings(settings)) throw new Error("Invalid page limits or delay.");
  const controller = new AbortController();
  const signal = controller.signal;
  let cursor = initial,
    pauseRequested = false,
    wake: (() => void) | undefined;
  let progress: Progress = {
    status: "working",
    steps: 0,
    snapshots: 0,
    rows: 0,
    note: "Verifying the first page…",
    duplicates: 0,
  };
  let dataset: Dataset | null = null;
  let total = 0;
  const keys = new Set<string>(),
    visited = new Set([initial.href]);
  const publish = (update: Partial<Progress>) => {
    progress = { ...progress, ...update };
    report(progress);
  };
  const set = (status: Status, note: string) => publish({ status, note });
  const finish = (status: Status, note: string): RunResult => {
    set(status, note);
    return { dataset, progress };
  };
  const deadline = setTimeout(() => controller.abort("deadline"), maxRunMs);
  function merge(next: Dataset) {
    if (!dataset) dataset = { version: 1, columns: next.columns, rows: [] };
    if (
      JSON.stringify(next.columns.map((c) => [c.id, c.kind, c.label])) !==
      JSON.stringify(dataset.columns.map((c) => [c.id, c.kind, c.label]))
    )
      throw new Error("The selected structure changed columns.");
    let growth = 0;
    let duplicates = 0;
    for (const { cells } of next.rows) {
      const key = JSON.stringify(cells);
      if (keys.has(key)) {
        duplicates++;
        continue;
      }
      const size = cells.reduce((sum, cell) => sum + units(cell), 0);
      if (
        dataset.rows.length >= maxDatasetRows ||
        total + size > maxDatasetUnits
      ) {
        publish({
          rows: dataset.rows.length,
          duplicates: progress.duplicates + duplicates,
        });
        return { growth, capped: true };
      }
      keys.add(key);
      total += size;
      growth++;
      dataset.rows.push({ id: `r${dataset.rows.length + 1}`, cells });
    }
    publish({
      rows: dataset.rows.length,
      duplicates: progress.duplicates + duplicates,
    });
    return { growth, capped: false };
  }
  function checked() {
    signal.throwIfAborted();
  }
  function monitored<T>(operation: () => Promise<T>): Promise<T> {
    checked();
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      Promise.resolve()
        .then(() => {
          checked();
          return operation();
        })
        .then(
          (value) => {
            signal.removeEventListener("abort", abort);
            resolve(value);
          },
          (error) => {
            signal.removeEventListener("abort", abort);
            reject(error);
          },
        );
    });
  }
  async function checkpoint() {
    checked();
    if (!pauseRequested) return;
    await new Promise<void>((resolve) => {
      const resume = () => {
        signal.removeEventListener("abort", resume);
        wake = undefined;
        resolve();
      };
      wake = resume;
      signal.addEventListener("abort", resume, { once: true });
      set(
        "paused",
        "Paused before the next action. Resume, or stop and keep verified records.",
      );
    });
    checked();
    set("working", "Verifying the next action…");
  }
  async function execute(): Promise<RunResult> {
    try {
      report(progress);
      for (let index = 0; index <= settings.steps; index++) {
        const result = await monitored(() =>
          port.read(cursor, index === 0, signal),
        );
        checked();
        if (!("dataset" in result)) return finish("recovery", result.note);
        const merged = merge(result.dataset);
        publish({ snapshots: progress.snapshots + 1 });
        if (merged.capped || result.status === "partial")
          return finish(
            "recovery",
            "A collection limit was reached. Only verified records are retained.",
          );
        if (index > 0 && !merged.growth && approved.mode !== "scroll")
          return finish(
            "complete",
            "No new records were found. No further actions were taken.",
          );
        if (index === settings.steps)
          return finish("complete", "Configured action limit reached.");
        await checkpoint();
        const detected = await monitored(() => port.inspect(cursor, signal));
        checked();
        // Stable evidence must still match the user's first reviewed action and any subsequent dynamic control.
        const action = detected.find(
          (candidate) =>
            candidate.mode === approved.mode &&
            (linked(approved)
              ? linked(candidate) &&
                (index > 0 || candidate.href === approved.href)
              : !linked(candidate) && candidate.key === approved.key),
        );
        if (!action)
          return finish(
            index === 0 ? "recovery" : "complete",
            index === 0
              ? "The reviewed control changed. Inspect it again before starting."
              : "No further matching action is available.",
          );
        if (linked(action) && visited.has(action.href))
          return finish(
            "complete",
            "A previously visited URL was offered. Stopped to prevent a loop.",
          );
        await checkpoint();
        publish({
          steps: index + 1,
          note: `Action ${index + 1} of ${settings.steps}: ${action.label}`,
        });
        checked();
        if (linked(action)) {
          const previous = cursor;
          cursor = await monitored(() => port.navigate(cursor, action, signal));
          checked();
          if (
            cursor.href !== action.href ||
            cursor.documentId === previous.documentId
          )
            return finish(
              "recovery",
              "Navigation did not reach the expected document.",
            );
          visited.add(cursor.href);
          await monitored(() => port.wait(settings.delay, signal));
          checked();
        } else {
          const changed = await monitored(() =>
            port.interact(cursor, action, settings.delay, signal),
          );
          checked();
          if (!changed)
            return finish(
              "recovery",
              "No verified page progress. The last action was not retried; check the page before a new run.",
            );
        }
      }
      return finish("complete", "Collection complete.");
    } catch (error) {
      if (signal.aborted)
        return finish(
          signal.reason === "deadline" ? "recovery" : "stopped",
          signal.reason === "deadline"
            ? "Time limit reached; only verified records are retained."
            : "Stopped. No further actions will be sent; an action already issued cannot be undone.",
        );
      return finish(
        "recovery",
        error instanceof Error
          ? error.message
          : "The action could not be verified. No automatic retry was attempted.",
      );
    } finally {
      clearTimeout(deadline);
    }
  }
  return {
    result: execute(),
    pause() {
      if (progress.status !== "working") return;
      pauseRequested = true;
      set("pausing", "Pausing after the current verification step…");
    },
    resume() {
      if (!pauseRequested) return;
      pauseRequested = false;
      if (wake) {
        const resume = wake;
        wake = undefined;
        resume();
      } else if (progress.status === "pausing") set("working", "Continuing…");
    },
    stop() {
      controller.abort("stopped");
    },
  };
}
