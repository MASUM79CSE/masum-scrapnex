import { browser } from "wxt/browser";
import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { isTrustedUiSender } from "../src/browser/protocol";
import { pickerPortName } from "../src/core/picker/contracts";
import { startPicker } from "../src/core/picker/session";

/** The slot belongs to Chrome's isolated world, not the webpage's global object. */
const slot = "__masumPickerDispose";
export default defineUnlistedScript(() => {
  if (window !== window.top || !/^https?:$/.test(location.protocol))
    return false;
  const isolated = globalThis as typeof globalThis & { [slot]?: () => void };
  isolated[slot]?.();
  let closeActive: (() => void) | undefined;
  const dropPending = () => {
    browser.runtime.onConnect.removeListener(connect);
    window.clearTimeout(timer);
  };
  const dispose = () => {
    dropPending();
    const active = closeActive;
    closeActive = undefined;
    active?.();
    if (isolated[slot] === dispose) delete isolated[slot];
  };
  const timer = window.setTimeout(dispose, 4_000);
  const connect: Parameters<typeof browser.runtime.onConnect.addListener>[0] = (
    port,
  ) => {
    if (
      port.name !== pickerPortName ||
      !port.sender ||
      !isTrustedUiSender(
        port.sender,
        browser.runtime.id,
        browser.runtime.getURL("/"),
      ) ||
      new URL(port.sender.url ?? "about:blank").pathname !== "/sidepanel.html"
    )
      return;
    dropPending();
    const session = startPicker(document, window, (message) => {
      try {
        port.postMessage(message);
      } catch {
        queueMicrotask(dispose);
      }
      if (message.type === "ended" || message.type === "collected")
        window.setTimeout(dispose, 120);
    });
    closeActive = () => {
      session.cleanup();
      port.onMessage.removeListener(session.command);
      port.onDisconnect.removeListener(dispose);
      port.disconnect();
    };
    port.onMessage.addListener(session.command);
    port.onDisconnect.addListener(dispose);
  };
  isolated[slot] = dispose;
  browser.runtime.onConnect.addListener(connect);
  return true;
});
