import type { PageDetection } from "../core/detector/contracts";

export type WorkspaceTab =
  | { state: "available"; tabId: number; windowId: number; origin: string }
  | { state: "restricted" | "unavailable" };

export interface WorkspacePort {
  getInvokedTab(): Promise<WorkspaceTab>;
  /** Call directly from an extension user gesture. */
  openSidePanel(windowId: number): Promise<void>;
}

export interface AgentPort {
  /** Caller is responsible for explicit user consent and bound tab/document context. */
  detectTopFrame(tabId: number, origin: string): Promise<PageDetection>;
}

export function describeTab(tab?: {
  id?: number | undefined;
  windowId?: number | undefined;
  url?: string | undefined;
}): WorkspaceTab {
  if (tab?.id === undefined || tab.windowId === undefined || !tab.url)
    return { state: "unavailable" };
  try {
    const url = new URL(tab.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hostname === "chromewebstore.google.com" ||
      (url.hostname === "chrome.google.com" &&
        url.pathname.startsWith("/webstore"))
    )
      return { state: "restricted" };
    return {
      state: "available",
      tabId: tab.id,
      windowId: tab.windowId,
      origin: url.origin,
    };
  } catch {
    return { state: "restricted" };
  }
}
