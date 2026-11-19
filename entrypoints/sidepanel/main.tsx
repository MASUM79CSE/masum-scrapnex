import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { extensionThemeStore } from "../../src/browser/preferences";
import { isShellStatus, type ShellRequest } from "../../src/browser/protocol";
import { SCHEMA_VERSION } from "../../src/data/contracts";
import { mount } from "../../src/styles/mount";
import { Workspace, type Connection } from "../../src/ui/workspace";

function SidePanel() {
  const [connection, setConnection] = useState<Connection>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void browser.runtime
      .sendMessage({
        kind: "shell/status",
        version: SCHEMA_VERSION,
      } satisfies ShellRequest)
      .then(
        (result: unknown) => {
          if (current)
            setConnection(isShellStatus(result) ? "connected" : "error");
        },
        () => {
          if (current) setConnection("error");
        },
      );
    return () => {
      current = false;
    };
  }, [attempt]);
  return (
    <Workspace
      mode="extension"
      connection={connection}
      themeStore={extensionThemeStore}
      retry={() => {
        setConnection("loading");
        setAttempt((n) => n + 1);
      }}
    />
  );
}

mount(<SidePanel />);
