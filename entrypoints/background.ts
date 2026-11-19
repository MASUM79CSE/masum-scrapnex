import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { SCHEMA_VERSION } from "../src/data/contracts";
import {
  isShellRequest,
  isTrustedUiSender,
  type ShellStatus,
} from "../src/browser/protocol";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      if (
        !isTrustedUiSender(
          sender,
          browser.runtime.id,
          browser.runtime.getURL("/"),
        ) ||
        !isShellRequest(message)
      )
        return;
      sendResponse({
        version: SCHEMA_VERSION,
        kind: "shell/ready",
      } satisfies ShellStatus);
    },
  );
});
