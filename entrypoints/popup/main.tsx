import { useEffect, useState } from "react";
import { chromeWorkspace } from "../../src/browser/chrome";
import type { WorkspaceTab } from "../../src/browser/ports";
import { PRODUCT_NAME } from "../../src/data/contracts";
import { mount } from "../../src/styles/mount";

function Popup() {
  const [tab, setTab] = useState<WorkspaceTab>();
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    void chromeWorkspace.getInvokedTab().then(
      (value) => {
        if (current) setTab(value);
      },
      () => {
        if (current) setTab({ state: "unavailable" });
      },
    );
    return () => {
      current = false;
    };
  }, []);

  function openWorkspace() {
    if (tab?.state !== "available") return;
    setError("");
    try {
      void chromeWorkspace.openSidePanel(tab.windowId).then(
        () => window.close(),
        () =>
          setError(
            "The side panel could not open. Return to the page and try the toolbar icon again.",
          ),
      );
    } catch {
      setError("The side panel API is not available in this browser.");
    }
  }

  return (
    <main className="w-72 space-y-3 p-4 text-sm">
      <h1 className="text-lg font-semibold">{PRODUCT_NAME}</h1>
      <p role="status" className="break-all">
        {tab?.state === "available"
          ? tab.origin
          : tab?.state === "restricted"
            ? "This page is restricted."
            : tab
              ? "No authorized web tab. Open this popup from the toolbar on a web page."
              : "Checking the active tab…"}
      </p>
      <button
        type="button"
        disabled={tab?.state !== "available"}
        onClick={openWorkspace}
        className="rounded border px-3 py-1 disabled:opacity-50"
      >
        Open side panel
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}

mount(<Popup />);
