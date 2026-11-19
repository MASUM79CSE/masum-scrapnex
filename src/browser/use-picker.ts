import type { CollectionResult } from "../core/extraction/contracts";
import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import {
  isPickerEvent,
  type PickerCommand,
  type PickerPreview,
  type PickerState,
} from "../core/picker/contracts";
import type { PickerView } from "../ui/picker-panel";
import { connectPicker, type PickerTarget } from "./connect-picker";

type Port = ReturnType<typeof browser.tabs.connect>;
interface Session {
  target: PickerTarget;
  port?: Port;
  timeout?: number;
}

export function usePicker(
  target: PickerTarget | null,
  onCollected: (result: CollectionResult) => void,
): PickerView {
  const [status, setStatus] = useState<PickerView["status"]>("idle");
  const [state, setState] = useState<PickerState | null>(null);
  const [confirmation, setConfirmation] = useState<PickerPreview | null>(null);
  const [error, setError] = useState("");
  const session = useRef<Session | null>(null);
  const binding = useRef<PickerTarget | null>(null);
  function release() {
    const value = session.current;
    session.current = null;
    if (value?.timeout !== undefined) window.clearTimeout(value.timeout);
    value?.port?.disconnect();
  }
  function close() {
    release();
    binding.current = null;
    setStatus("idle");
    setState(null);
    setConfirmation(null);
    setError("");
  }
  useEffect(() => {
    const activated: Parameters<
      typeof browser.tabs.onActivated.addListener
    >[0] = ({ tabId, windowId }) => {
      const bound = binding.current;
      if (bound && (windowId !== bound.windowId || tabId !== bound.tabId))
        close();
    };
    const updated: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (
      tabId,
      change,
    ) => {
      if (
        tabId === binding.current?.tabId &&
        (change.url !== undefined || change.status === "loading")
      )
        close();
    };
    const removed: Parameters<typeof browser.tabs.onRemoved.addListener>[0] = (
      tabId,
    ) => {
      if (tabId === binding.current?.tabId) close();
    };
    const focused: Parameters<
      typeof browser.windows.onFocusChanged.addListener
    >[0] = (windowId) => {
      if (
        binding.current &&
        windowId !== -1 &&
        windowId !== binding.current.windowId
      )
        close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && session.current) {
        event.preventDefault();
        close();
      }
    };
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    browser.windows.onFocusChanged.addListener(focused);
    window.addEventListener("keydown", key);
    return () => {
      release();
      binding.current = null;
      browser.tabs.onActivated.removeListener(activated);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
      browser.windows.onFocusChanged.removeListener(focused);
      window.removeEventListener("keydown", key);
    };
  }, []);
  function fail(message: string) {
    release();
    setState(null);
    setConfirmation(null);
    setError(message);
    setStatus("error");
  }
  function start() {
    if (!target || session.current) return;
    const value: Session = { target };
    session.current = value;
    binding.current = target;
    setState(null);
    setConfirmation(null);
    setError("");
    setStatus("connecting");
    value.timeout = window.setTimeout(() => {
      if (session.current === value)
        fail(
          "The page picker did not respond. Try again from the authorized tab.",
        );
    }, 5_000);
    void connectPicker(value.target).then(
      (port) => {
        if (session.current !== value) {
          port.disconnect();
          return;
        }
        value.port = port;
        port.onMessage.addListener((message: unknown) => {
          if (session.current !== value) return;
          if (!isPickerEvent(message)) {
            fail("The page picker returned an invalid response.");
            return;
          }
          if (value.timeout !== undefined) window.clearTimeout(value.timeout);
          if (message.type === "collected") {
            close();
            onCollected(message.result);
            return;
          }
          if (message.type === "state") {
            setState(message.state);
            setStatus("active");
            return;
          }
          if (message.reason === "confirmed" && message.preview) {
            release();
            setState(null);
            setConfirmation(message.preview);
            setStatus("confirmed");
          } else if (message.reason === "expired")
            fail(
              "The picker timed out after two minutes. Start a new selection.",
            );
          else if (message.reason === "page-changed")
            fail("The page changed while picking. Start a new selection.");
          else close();
        });
        port.onDisconnect.addListener(() => {
          if (session.current === value)
            fail(
              "The picker disconnected. Start a new selection if the page is still authorized.",
            );
        });
      },
      () => {
        if (session.current === value)
          fail(
            "Could not start the picker. Reopen the toolbar popup on the page and try again.",
          );
      },
    );
  }
  function command(message: PickerCommand) {
    try {
      const active = session.current;
      if (message.action === "collect" && active?.port) {
        setStatus("collecting");
        if (active.timeout !== undefined) window.clearTimeout(active.timeout);
        active.timeout = window.setTimeout(() => {
          if (session.current === active)
            fail("The collection did not finish. Start a new picker session.");
        }, 8_000);
      }
      session.current?.port?.postMessage(message);
    } catch {
      fail("The picker connection was interrupted.");
    }
  }
  return { status, state, confirmation, error, start, close, command };
}
