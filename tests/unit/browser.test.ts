import { describe, expect, it } from "vitest";
import { describeTab } from "../../src/browser/ports";
import {
  isShellRequest,
  isShellStatus,
  isTrustedUiSender,
} from "../../src/browser/protocol";

const runtimeId = "abcdefghijklmnopabcdefghijklmnop";
const extensionBase = `chrome-extension://${runtimeId}/`;

describe("browser boundary", () => {
  it("returns only the origin, not the path or query", () => {
    expect(
      describeTab({
        id: 0,
        windowId: 3,
        url: "https://example.test/private?q=secret#anchor",
      }),
    ).toEqual({
      state: "available",
      tabId: 0,
      windowId: 3,
      origin: "https://example.test",
    });
  });
  it("handles no grant and incomplete tab data without guessing", () => {
    expect(describeTab()).toEqual({ state: "unavailable" });
    expect(describeTab({ id: 2, windowId: 1 })).toEqual({
      state: "unavailable",
    });
  });
  it.each([
    "chrome://settings",
    "file:///tmp/test",
    "not a url",
    "https://chromewebstore.google.com/detail/test",
    "https://user:pass@example.test/",
  ])("rejects unsupported URL %s", (url) => {
    expect(describeTab({ id: 2, windowId: 1, url })).toEqual({
      state: "restricted",
    });
  });
  it("accepts only the versioned request and status envelopes", () => {
    expect(isShellRequest({ version: 1, kind: "shell/status" })).toBe(true);
    expect(isShellStatus({ version: 1, kind: "shell/ready" })).toBe(true);
    for (const input of [
      null,
      [],
      Object.create({ version: 1, kind: "shell/status" }),
      { version: 2, kind: "shell/status" },
      { version: 1, kind: "shell/status", tabId: 2 },
      { version: 1, kind: "shell/ready" },
    ]) {
      expect(isShellRequest(input)).toBe(false);
    }
  });
  it("accepts only approved extension UI pages for the shell command", () => {
    expect(
      isTrustedUiSender(
        { id: runtimeId, url: `${extensionBase}sidepanel.html` },
        runtimeId,
        extensionBase,
      ),
    ).toBe(true);
    for (const sender of [
      { id: "different-id", url: `${extensionBase}sidepanel.html` },
      { id: runtimeId },
      { id: runtimeId, url: `${extensionBase}background.js` },
      { id: runtimeId, url: `https://${runtimeId}/sidepanel.html` },
    ]) {
      expect(isTrustedUiSender(sender, runtimeId, extensionBase)).toBe(false);
    }
  });
});
