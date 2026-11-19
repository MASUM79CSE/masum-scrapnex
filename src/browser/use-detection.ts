import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import type { PageDetection } from "../core/detector/contracts";
import type { DetectionView } from "../ui/live-detection";
import { chromeAgent, chromeWorkspace } from "./chrome";
import type { ScanBinding, WorkspaceTab } from "./ports";

type Target = Extract<WorkspaceTab, { state: "available" }>;

export function useDetection(): DetectionView & {
  authorizedTarget: Target | null;
  captureContext: () => { binding: ScanBinding; current: () => boolean } | null;
} {
  const [target, setTarget] = useState<Target | null>(null);
  const ref = useRef<Target | null>(null);
  const epoch = useRef(0);
  const binding = useRef<ScanBinding | null>(null);
  const running = useRef(false);
  const [state, setState] = useState<DetectionView["state"]>("idle");
  const [report, setReport] = useState<PageDetection | null>(null);
  useEffect(() => {
    function refresh() {
      const current = ++epoch.current;
      ref.current = null;
      binding.current = null;
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
        (change.url !== undefined ||
          change.status === "loading" ||
          (change.status === "complete" && ref.current === null))
      )
        refresh();
    };
    const removed: Parameters<typeof browser.tabs.onRemoved.addListener>[0] = (
      id,
    ) => {
      if (id === ref.current?.tabId) refresh();
    };
    const activated: Parameters<
      typeof browser.tabs.onActivated.addListener
    >[0] = ({ tabId, windowId }) => {
      if (tabId !== ref.current?.tabId || windowId !== ref.current.windowId)
        refresh();
    };
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    const focused = (windowId: number) => {
      if (windowId !== -1 && windowId !== ref.current?.windowId) refresh();
    };
    browser.windows.onFocusChanged.addListener(focused);
    refresh();
    return () => {
      epoch.current += 1;
      browser.tabs.onActivated.removeListener(activated);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
      browser.windows.onFocusChanged.removeListener(focused);
    };
  }, []);
  function scan() {
    const tab = ref.current;
    if (!tab || running.current) return;
    const current = ++epoch.current;
    running.current = true;
    binding.current = null;
    setReport(null);
    setState("running");
    void chromeAgent.detectTopFrame(tab.tabId, tab.origin).then(
      (result) => {
        if (current !== epoch.current) return;
        running.current = false;
        binding.current = result.binding;
        setReport(result.report);
        setState("ready");
      },
      () => {
        if (current !== epoch.current) return;
        running.current = false;
        setState("error");
      },
    );
  }
  return {
    origin: target?.origin ?? null,
    state,
    report,
    scan,
    authorizedTarget: target,
    captureContext() {
      const active = binding.current;
      const generation = epoch.current;
      return active
        ? {
            binding: active,
            current: () =>
              epoch.current === generation && binding.current === active,
          }
        : null;
    },
  };
}
