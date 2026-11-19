import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import type { DetectedCandidate } from "../core/detector/contracts";
import type { CollectionResult } from "../core/extraction/contracts";
import {
  isSettings,
  type Action,
  type Settings,
} from "../core/pagination/contracts";
import { startRun, type Progress } from "../core/pagination/run";
import { createPaginationPort, cursorFor } from "./pagination";
import type { ScanBinding } from "./ports";

type Context = () => { binding: ScanBinding; current: () => boolean } | null;
type Review = {
  binding: ScanBinding;
  current: () => boolean;
  candidate: DetectedCandidate;
  actions: Action[];
};
export interface PaginationView {
  busy: boolean;
  review: Review | null;
  progress: Progress | null;
  error: string;
  inspect: (candidate: DetectedCandidate) => void;
  start: (action: Action, settings: Settings) => void;
  close: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}
export function usePagination(
  context: Context,
  accept: (result: CollectionResult) => void,
): PaginationView {
  const run = useRef<ReturnType<typeof startRun> | null>(null),
    preflight = useRef<AbortController | null>(null);
  const owned = useRef<ScanBinding | null>(null);
  const mounted = useRef(false);
  const [busy, setBusy] = useState(false),
    [review, setReview] = useState<Review | null>(null),
    [progress, setProgress] = useState<Progress | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    const activated: Parameters<
      typeof browser.tabs.onActivated.addListener
    >[0] = ({ tabId, windowId }) => {
      if (
        owned.current &&
        (tabId !== owned.current.tabId || windowId !== owned.current.windowId)
      )
        stop();
    };
    const removed = (tabId: number) => {
      if (owned.current?.tabId === tabId) stop();
    };
    const focused = (windowId: number) => {
      if (
        owned.current &&
        windowId !== -1 &&
        windowId !== owned.current.windowId
      )
        stop();
    };
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onRemoved.addListener(removed);
    browser.windows.onFocusChanged.addListener(focused);
    return () => {
      mounted.current = false;
      stop();
      browser.tabs.onActivated.removeListener(activated);
      browser.tabs.onRemoved.removeListener(removed);
      browser.windows.onFocusChanged.removeListener(focused);
    };
  }, []);
  function stop() {
    run.current?.stop();
    preflight.current?.abort();
  }
  function close() {
    if (run.current) return;
    stop();
    owned.current = null;
    setReview(null);
    setProgress(null);
    setError("");
  }
  function inspect(candidate: DetectedCandidate) {
    if (run.current || preflight.current) return;
    const scan = context();
    if (!scan) {
      setError("Analyze the authorized page before inspecting pagination.");
      return;
    }
    owned.current = scan.binding;
    setError("");
    setProgress(null);
    setReview(null);
    setBusy(true);
    const controller = new AbortController();
    preflight.current = controller;
    void createPaginationPort(scan.binding, candidate)
      .inspect(cursorFor(scan.binding), controller.signal)
      .then(
        (actions) => {
          if (!mounted.current || controller.signal.aborted) return;
          if (!scan.current())
            setError("The analyzed page changed. Analyze it again.");
          else setReview({ ...scan, candidate, actions });
        },
        () => {
          if (mounted.current && !controller.signal.aborted)
            setError(
              "Could not inspect controls on the authorized page. Analyze it again.",
            );
        },
      )
      .finally(() => {
        if (preflight.current === controller) {
          preflight.current = null;
          if (mounted.current) setBusy(false);
        }
      });
  }
  function start(action: Action, settings: Settings) {
    if (
      run.current ||
      !review ||
      !review.actions.includes(action) ||
      !isSettings(settings)
    )
      return;
    if (!review.current()) {
      setError(
        "The reviewed page changed. Reinspect controls before starting.",
      );
      setReview(null);
      return;
    }
    setError("");
    setReview(null);
    setBusy(true);
    const active = startRun(
      cursorFor(review.binding),
      action,
      settings,
      createPaginationPort(review.binding, review.candidate),
      (state) => {
        if (mounted.current) setProgress(state);
      },
    );
    run.current = active;
    void active.result
      .then(({ dataset, progress }) => {
        if (!mounted.current) return;
        if (dataset?.rows.length)
          accept({
            version: 1,
            status: progress.status === "complete" ? "complete" : "partial",
            dataset,
            note: progress.note,
          });
      })
      .finally(() => {
        if (run.current === active) {
          run.current = null;
          owned.current = null;
          if (mounted.current) setBusy(false);
        }
      });
  }
  return {
    busy,
    review,
    progress,
    error,
    inspect,
    start,
    close,
    stop,
    pause: () => run.current?.pause(),
    resume: () => run.current?.resume(),
  };
}
