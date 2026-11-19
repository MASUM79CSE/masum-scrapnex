import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { isShellStatus, type ShellRequest } from "../../src/browser/protocol";
import { PRODUCT_NAME, SCHEMA_VERSION } from "../../src/data/contracts";
import { mount } from "../../src/styles/mount";

function SidePanel() {
  const [status, setStatus] = useState("Checking extension connection…");
  useEffect(() => {
    let current = true;
    void browser.runtime
      .sendMessage({
        version: SCHEMA_VERSION,
        kind: "shell/status",
      } satisfies ShellRequest)
      .then(
        (result: unknown) => {
          if (current)
            setStatus(
              isShellStatus(result)
                ? "Extension connected."
                : "Unexpected extension response.",
            );
        },
        () => {
          if (current)
            setStatus("Could not connect. Reopen the side panel to retry.");
        },
      );
    return () => {
      current = false;
    };
  }, []);

  return (
    <main className="space-y-3 p-4 text-sm">
      <h1 className="text-lg font-semibold">{PRODUCT_NAME}</h1>
      <p role="status">{status}</p>
      <p>
        Development foundation. Webpage analysis is not available in this build.
      </p>
    </main>
  );
}

mount(<SidePanel />);
