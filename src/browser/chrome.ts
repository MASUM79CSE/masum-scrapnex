import { browser } from "wxt/browser";
import { changedPage, isPageDetection } from "../core/detector/contracts";
import { describeTab, type AgentPort, type WorkspacePort } from "./ports";

export const chromeWorkspace: WorkspacePort = {
  async getInvokedTab() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return describeTab(tab);
  },
  openSidePanel(windowId) {
    return browser.sidePanel.open({ windowId });
  },
};

export const chromeAgent: AgentPort = {
  async detectTopFrame(tabId, origin) {
    const [before] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const target = describeTab(before);
    if (
      !before ||
      target.state !== "available" ||
      target.tabId !== tabId ||
      target.origin !== origin ||
      before.status !== "complete"
    ) {
      throw new Error("The current page is not ready or authorized.");
    }
    const [binding] = await browser.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      world: "ISOLATED",
      func: () => location.href,
    });
    if (
      binding?.frameId !== 0 ||
      !binding.documentId ||
      binding.result !== before.url
    )
      return { report: changedPage(), binding: null };
    const [injection] = await browser.scripting.executeScript({
      target: { tabId, documentIds: [binding.documentId] },
      files: ["/page-agent.js"],
      world: "ISOLATED",
    });
    const [after] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (
      !after ||
      before.id !== after.id ||
      before.url !== after.url ||
      target.windowId !== after.windowId ||
      after.status !== "complete"
    )
      return { report: changedPage(), binding: null };
    if (
      injection?.frameId !== 0 ||
      injection.documentId !== binding.documentId ||
      !isPageDetection(injection.result)
    )
      throw new Error("Unexpected page analysis response.");
    return {
      report: injection.result,
      binding: {
        tabId,
        windowId: target.windowId,
        documentId: binding.documentId,
        href: before.url!,
      },
    };
  },
};
