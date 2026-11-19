import { Globe2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { chromeWorkspace } from "../../src/browser/chrome";
import type { WorkspaceTab } from "../../src/browser/ports";
import { extensionThemeStore } from "../../src/browser/preferences";
import { mount } from "../../src/styles/mount";
import { Brand, LocalBadge, OpenLabel } from "../../src/ui/brand";
import { useTheme } from "../../src/ui/theme";

function Popup() {
  const [tab, setTab] = useState<WorkspaceTab>();
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  useTheme(extensionThemeStore, "system");
  useEffect(() => {
    let current = true;
    void chromeWorkspace.getInvokedTab().then(
      (value) => {
        if (current) setTab(value);
      },
      () => {
        if (current) {
          setTab({ state: "unavailable" });
          setError(
            "Could not check the current tab. Reopen the popup to try again.",
          );
        }
      },
    );
    return () => {
      current = false;
    };
  }, []);

  function openWorkspace() {
    if (tab?.state !== "available" || opening) return;
    setError("");
    setOpening(true);
    try {
      void chromeWorkspace.openSidePanel(tab.windowId).then(
        () => window.close(),
        () => {
          setOpening(false);
          setError(
            "Could not open the side panel. Use the toolbar on an ordinary web page and try again.",
          );
        },
      );
    } catch {
      setOpening(false);
      setError("The side-panel API is not available in this browser.");
    }
  }

  return (
    <main className="popup" aria-label="MASUM SCRAPNEX">
      <header className="popup-top">
        <Brand />
        <LocalBadge />
      </header>
      <section className="popup-body">
        <p className="eyebrow">
          <span aria-hidden="true" /> QUICK ACCESS
        </p>
        <h1>Open workspace</h1>
        <p>
          Inspect candidates and preview sample records. Live analysis is not
          enabled yet.
        </p>
        <p role="status" className="popup-status">
          {tab ? (
            <Globe2 size={16} aria-hidden="true" />
          ) : (
            <LoaderCircle size={16} className="spin" aria-hidden="true" />
          )}
          <span>
            {tab?.state === "available"
              ? tab.origin
              : tab?.state === "restricted"
                ? "This page is restricted."
                : tab
                  ? "No authorized web tab. Open the toolbar popup on a web page."
                  : "Checking the active tab…"}
          </span>
        </p>
        <button
          type="button"
          className="button button--primary"
          disabled={tab?.state !== "available" || opening}
          onClick={openWorkspace}
        >
          {opening ? "Opening…" : <OpenLabel />}
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
      <footer className="popup-foot">
        <span>No extraction sessions yet</span>
        <a href="/options.html" target="_blank" rel="noopener">
          Settings
        </a>
      </footer>
    </main>
  );
}

mount(<Popup />);
