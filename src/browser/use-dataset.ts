import { useRef, useState } from "react";
import type { DetectedCandidate } from "../core/detector/contracts";
import type { CollectionResult, Dataset } from "../core/extraction/contracts";
import { collectFromTab } from "./collect";
import type { ScanBinding } from "./ports";
import { changedCollection } from "../core/extraction/collect";

export interface DatasetView {
  dataset: Dataset | null;
  open: boolean;
  busy: boolean;
  error: string;
  note: string;
  partial: boolean;
  collect: (candidate: DetectedCandidate) => void;
  accept: (capture: CollectionResult) => void;
  save: (update: (dataset: Dataset) => Dataset) => void;
  show: () => void;
  back: () => void;
  discard: () => void;
}
export function useDataset(
  context: () => { binding: ScanBinding; current: () => boolean } | null,
): DatasetView {
  const current = useRef<Dataset | null>(null);
  const capture = useRef(false);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [partial, setPartial] = useState(false);
  function update(next: Dataset | null) {
    current.current = next;
    setDataset(next);
  }
  function accept(result: CollectionResult) {
    if (!("dataset" in result)) {
      setError(result.note);
      return;
    }
    if (current.current) {
      setError(
        "A dataset is already open. Discard it before collecting another.",
      );
      return;
    }
    setError("");
    setNote(result.note);
    setPartial(result.status === "partial");
    update(result.dataset);
    setOpen(true);
  }
  function collect(candidate: DetectedCandidate) {
    if (capture.current || current.current) return;
    const scan = context();
    if (!scan) {
      accept(changedCollection());
      return;
    }
    capture.current = true;
    setBusy(true);
    setError("");
    void collectFromTab(scan.binding, candidate)
      .then(
        (result) => accept(scan.current() ? result : changedCollection()),
        () =>
          setError(
            "Collection failed. Reopen the toolbar popup on the authorized tab and analyze again.",
          ),
      )
      .finally(() => {
        capture.current = false;
        setBusy(false);
      });
  }
  return {
    dataset,
    open,
    busy,
    error,
    note,
    partial,
    collect,
    accept,
    save(updater) {
      if (current.current) update(updater(current.current));
    },
    show() {
      setOpen(true);
    },
    back() {
      setOpen(false);
    },
    discard() {
      update(null);
      setOpen(false);
      setError("");
      setNote("");
      setPartial(false);
    },
  };
}
