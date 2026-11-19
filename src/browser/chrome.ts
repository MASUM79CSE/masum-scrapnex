import { browser } from "wxt/browser";
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

// Not exposed by the Phase 02 UI; Phase 04 must bind it to fresh authorized context.
export const chromeAgent: AgentPort = {
  async injectTopFrame(tabId) {
    await browser.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ["/page-agent.js"],
      world: "ISOLATED",
    });
  },
};
