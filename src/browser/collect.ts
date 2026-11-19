import { browser } from "wxt/browser";
import type { DetectedCandidate } from "../core/detector/contracts";
import { candidateSignature } from "../core/extraction/signature";
import { changedCollection } from "../core/extraction/collect";
import { isCollectionResult } from "../core/extraction/contracts";
import { describeTab, type ScanBinding } from "./ports";

export async function collectFromTab(
  target: ScanBinding,
  candidate: DetectedCandidate,
) {
  const [before] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const tab = describeTab(before);
  if (
    before?.url !== target.href ||
    before.status !== "complete" ||
    tab.state !== "available" ||
    tab.tabId !== target.tabId ||
    tab.windowId !== target.windowId
  )
    return changedCollection();
  const [binding] = await browser.scripting.executeScript({
    target: { tabId: tab.tabId, documentIds: [target.documentId] },
    world: "ISOLATED",
    args: [
      {
        id: candidate.id,
        signature: candidateSignature(candidate),
        href: before.url,
      },
    ],
    func: (input: { id: string; signature: string; href: string }) => {
      if (window !== window.top || location.href !== input.href) return false;
      const isolated = globalThis as typeof globalThis & {
        __masumCollection?: typeof input;
      };
      isolated.__masumCollection = input;
      setTimeout(() => {
        if (isolated.__masumCollection === input)
          delete isolated.__masumCollection;
      }, 3_000);
      return true;
    },
  });
  if (
    binding?.documentId !== target.documentId ||
    binding.frameId !== 0 ||
    binding.result !== true
  )
    return changedCollection();
  const [capture] = await browser.scripting.executeScript({
    target: { tabId: tab.tabId, documentIds: [binding.documentId] },
    world: "ISOLATED",
    files: ["/collector.js"],
  });
  const [after] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (
    !after ||
    after.id !== before.id ||
    after.url !== before.url ||
    after.windowId !== before.windowId ||
    after.status !== "complete"
  )
    return changedCollection();
  if (
    capture?.frameId !== 0 ||
    capture.documentId !== binding.documentId ||
    !isCollectionResult(capture.result)
  )
    throw new Error("Invalid collection result");
  return capture.result;
}
