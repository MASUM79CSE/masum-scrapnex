import { browser } from "wxt/browser";
import type { DetectedCandidate } from "../core/detector/contracts";
import {
  candidateSignature,
  schemaSignature,
} from "../core/extraction/signature";
import {
  isAction,
  isDynamicResult,
  sameWebUrl,
  validCapture,
  type RunCommand,
} from "../core/pagination/contracts";
import {
  abortableDelay,
  type Adapter,
  type Cursor,
} from "../core/pagination/run";
import { describeTab, type ScanBinding } from "./ports";

export function createPaginationPort(
  source: ScanBinding,
  candidate: DetectedCandidate,
): Adapter {
  const origin = new URL(source.href).origin;
  const unverified = () =>
    new Error(
      "The active tab or expected document changed. Check the page and analyze again.",
    );
  async function active(signal: AbortSignal) {
    signal.throwIfAborted();
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    signal.throwIfAborted();
    if (!tab || tab.id !== source.tabId || tab.windowId !== source.windowId)
      throw unverified();
    return tab;
  }
  async function invoke(
    cursor: Cursor,
    command: RunCommand,
    signal: AbortSignal,
  ): Promise<unknown> {
    const before = await active(signal);
    const state = describeTab(before);
    if (
      before.url !== cursor.href ||
      before.status !== "complete" ||
      state.state !== "available" ||
      state.origin !== origin
    )
      throw unverified();
    const [armed] = await browser.scripting.executeScript({
      target: { tabId: source.tabId, documentIds: [cursor.documentId] },
      world: "ISOLATED",
      args: [{ href: cursor.href, command }],
      func: (message: { href: string; command: RunCommand }) => {
        if (location.href !== message.href || window !== window.top)
          return false;
        const isolated = globalThis as typeof globalThis & {
          __masumPagination?: typeof message;
        };
        isolated.__masumPagination = message;
        setTimeout(() => {
          if (isolated.__masumPagination === message)
            delete isolated.__masumPagination;
        }, 2500);
        return true;
      },
    });
    if (
      armed?.frameId !== 0 ||
      armed.documentId !== cursor.documentId ||
      armed.result !== true
    )
      throw unverified();
    const confirmed = await active(signal);
    if (confirmed.url !== cursor.href || confirmed.status !== "complete")
      throw unverified();
    signal.throwIfAborted();
    const [answer] = await browser.scripting.executeScript({
      target: { tabId: source.tabId, documentIds: [cursor.documentId] },
      world: "ISOLATED",
      files: ["/paginator.js"],
    });
    const after = await active(signal);
    if (
      after.url !== cursor.href ||
      after.status !== "complete" ||
      answer?.frameId !== 0 ||
      answer.documentId !== cursor.documentId
    )
      throw unverified();
    return answer.result;
  }
  return {
    async inspect(cursor, signal) {
      const result = await invoke(cursor, { kind: "inspect" }, signal);
      if (
        !Array.isArray(result) ||
        result.length > 5 ||
        !result.every((entry: unknown) => isAction(entry, cursor.href))
      )
        throw new Error("No verified pagination controls were returned.");
      return result;
    },
    async read(cursor, initial, signal) {
      const result = await invoke(
        cursor,
        {
          kind: "read",
          initial,
          id: candidate.id,
          signature: initial
            ? candidateSignature(candidate)
            : schemaSignature(candidate),
        },
        signal,
      );
      if (!validCapture(result))
        throw new Error("The browser returned an invalid capture.");
      return result;
    },
    async navigate(cursor, action, signal) {
      if (
        sameWebUrl(action.href, source.href) !== action.href ||
        action.href === cursor.href
      )
        throw unverified();
      const detected = await invoke(cursor, { kind: "inspect" }, signal);
      if (
        !Array.isArray(detected) ||
        !detected.some(
          (entry: unknown) =>
            isAction(entry, cursor.href) &&
            "href" in entry &&
            entry.mode === action.mode &&
            entry.href === action.href,
        )
      )
        throw new Error(
          "The reviewed destination is no longer offered by the page.",
        );
      const tab = await active(signal);
      if (tab.url !== cursor.href || tab.status !== "complete")
        throw unverified();
      // Check the exact read document immediately before sending the one authorized navigation.
      const [probe] = await browser.scripting.executeScript({
        target: { tabId: source.tabId, documentIds: [cursor.documentId] },
        world: "ISOLATED",
        func: () => location.href,
      });
      if (
        probe?.documentId !== cursor.documentId ||
        probe.result !== cursor.href ||
        probe.frameId !== 0
      )
        throw unverified();
      signal.throwIfAborted();
      await browser.tabs.update(source.tabId, { url: action.href });
      const until = performance.now() + 12_000;
      while (performance.now() < until) {
        const next = await active(signal);
        const pending = next.pendingUrl;
        if (
          (pending && pending !== action.href && pending !== cursor.href) ||
          (next.url && next.url !== cursor.href && next.url !== action.href)
        )
          throw new Error(
            "Unexpected redirect or navigation. The destination was not read and will not be retried.",
          );
        if (next.status === "complete" && next.url === action.href) {
          const [binding] = await browser.scripting.executeScript({
            target: { tabId: source.tabId, frameIds: [0] },
            world: "ISOLATED",
            func: () => location.href,
          });
          const after = await active(signal);
          if (
            binding?.frameId === 0 &&
            binding.result === action.href &&
            binding.documentId &&
            binding.documentId !== cursor.documentId &&
            after.url === action.href &&
            after.status === "complete"
          )
            return { href: action.href, documentId: binding.documentId };
          throw unverified();
        }
        await abortableDelay(150, signal);
      }
      throw new Error(
        "Navigation could not be verified before the time limit. No automatic retry was attempted.",
      );
    },
    async interact(cursor, action, delay, signal) {
      const result = await invoke(
        cursor,
        { kind: "act", action, delay },
        signal,
      );
      if (!isDynamicResult(result))
        throw new Error("The page did not return verified interaction status.");
      return result === "changed";
    },
    wait: abortableDelay,
  };
}
export function cursorFor(source: ScanBinding): Cursor {
  return { href: source.href, documentId: source.documentId };
}
