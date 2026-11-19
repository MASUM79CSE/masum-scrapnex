import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import type { PageDetection } from "../core/detector/contracts";
import type { DetectionView } from "../ui/live-detection";
import { chromeAgent, chromeWorkspace } from "./chrome";
import type { WorkspaceTab } from "./ports";

type Target = Extract<WorkspaceTab, { state: "available" }>;

export function useDetection(): DetectionView {
  const [target, setTarget] = useState<Target | null>(null);
  const ref = useRef<Target | null>(null);
  const epoch = useRef(0);
  const running = useRef(false);
  const [state, setState] = useState<DetectionView["state"]>("idle");
  const [report, setReport] = useState<PageDetection | null>(null);
  useEffect(() => {
    function refresh() {
      const current = ++epoch.current;
      ref.current = null;
      running.current = false;
      setTarget(null);
      setReport(null);
      setState("idle");
      void chromeWorkspace.getInvokedTab().then(
        (tab) => {
          if (current === epoch.current && tab.state === "available") {
            ref.current = tab;
            setTarget(tab);
          }
        },
        () => {},
      );
    }
    const updated: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (
      id,
      change,
      tab,
    ) => {
      if (
        (id === ref.current?.tabId || tab.active) &&
        (change.url !== undefined || change.status !== undefined)
      )
        refresh();
    };
    const removed: Parameters<typeof browser.tabs.onRemoved.addListener>[0] = (
      id,
    ) => {
      if (id === ref.current?.tabId) refresh();
    };
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    browser.windows.onFocusChanged.addListener(refresh);
    refresh();
    return () => {
      epoch.current += 1;
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
      browser.windows.onFocusChanged.removeListener(refresh);
    };
  }, []);
  function scan() {
    const tab = ref.current;
    if (!tab || running.current) return;
    const current = ++epoch.current;
    running.current = true;
    setReport(null);
    setState("running");
    void chromeAgent.detectTopFrame(tab.tabId, tab.origin).then(
      (result) => {
        if (current !== epoch.current) return;
        running.current = false;
        setReport(result);
        setState("ready");
      },
      () => {
        if (current !== epoch.current) return;
        running.current = false;
        setState("error");
      },
    );
  }
  return { origin: target?.origin ?? null, state, report, scan };
}
