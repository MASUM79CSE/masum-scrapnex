import { SCHEMA_VERSION } from "../data/contracts";

export type ShellRequest = {
  version: typeof SCHEMA_VERSION;
  kind: "shell/status";
};
export type ShellStatus = {
  version: typeof SCHEMA_VERSION;
  kind: "shell/ready";
};

function matches(
  value: unknown,
  kind: ShellRequest["kind"] | ShellStatus["kind"],
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const input = value as Record<string, unknown>;
  return (
    Object.keys(input).length === 2 &&
    Object.hasOwn(input, "version") &&
    Object.hasOwn(input, "kind") &&
    input.version === SCHEMA_VERSION &&
    input.kind === kind
  );
}

export function isShellRequest(value: unknown): value is ShellRequest {
  return matches(value, "shell/status");
}

export function isShellStatus(value: unknown): value is ShellStatus {
  return matches(value, "shell/ready");
}

const trustedPaths = new Set([
  "/popup.html",
  "/sidepanel.html",
  "/options.html",
]);

export function isTrustedUiSender(
  sender: { id?: string | undefined; url?: string | undefined },
  runtimeId: string,
  extensionBase: string,
): boolean {
  if (sender.id !== runtimeId || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    const base = new URL(extensionBase);
    // Extension URL origins are not reliably serialized by URL in every JS runtime.
    return (
      url.protocol === base.protocol &&
      url.host === base.host &&
      !url.username &&
      !url.password &&
      trustedPaths.has(url.pathname)
    );
  } catch {
    return false;
  }
}
