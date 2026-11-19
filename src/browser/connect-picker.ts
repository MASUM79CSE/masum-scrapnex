import { browser } from "wxt/browser";
import { pickerPortName } from "../core/picker/contracts";
import { describeTab, type WorkspaceTab } from "./ports";

export type PickerTarget = Extract<WorkspaceTab, { state: "available" }>;
export async function connectPicker(target: PickerTarget) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const active = describeTab(tab);
  if (
    !tab ||
    active.state !== "available" ||
    active.tabId !== target.tabId ||
    active.origin !== target.origin ||
    tab.status !== "complete"
  )
    throw new Error("Page not authorized");
  const [binding] = await browser.scripting.executeScript({
    target: { tabId: target.tabId, frameIds: [0] },
    world: "ISOLATED",
    func: () => location.href,
  });
  if (
    binding?.frameId !== 0 ||
    !binding.documentId ||
    binding.result !== tab.url
  )
    throw new Error("Document changed");
  const [setup] = await browser.scripting.executeScript({
    target: { tabId: target.tabId, documentIds: [binding.documentId] },
    world: "ISOLATED",
    files: ["/picker.js"],
  });
  if (
    setup?.frameId !== 0 ||
    setup.documentId !== binding.documentId ||
    setup.result !== true
  )
    throw new Error("Picker setup failed");
  const [after] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (
    !after ||
    after.id !== tab.id ||
    after.url !== tab.url ||
    after.status !== "complete"
  )
    throw new Error("Tab changed");
  return browser.tabs.connect(target.tabId, {
    name: pickerPortName,
    documentId: binding.documentId,
  });
}
