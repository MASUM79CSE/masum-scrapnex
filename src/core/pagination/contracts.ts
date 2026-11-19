import {
  isCollectionResult,
  type CollectionResult,
} from "../extraction/contracts";

export const maxSteps = 10;
export const minDelay = 500;
export const maxDelay = 5000;
export const maxRunMs = 120_000;
export type Mode = "next" | "numbered" | "url" | "more" | "scroll";
export type LinkAction = {
  mode: "next" | "numbered" | "url";
  label: string;
  href: string;
};
export type DynamicAction = {
  mode: "more" | "scroll";
  label: string;
  key: string;
};
export type Action = LinkAction | DynamicAction;
export interface Settings {
  steps: number;
  delay: number;
}
export type RunCommand =
  | { kind: "inspect" }
  | { kind: "act"; action: DynamicAction; delay: number }
  | { kind: "read"; id: string; signature: string; initial: boolean };
export const linked = (a: Action): a is LinkAction => "href" in a;
export function sameWebUrl(
  input: string | null,
  base: string,
  allowHash = false,
) {
  if (!input || input.length > 1800) return null;
  try {
    const from = new URL(base),
      url = new URL(input, base);
    if (
      !/^https?:$/.test(url.protocol) ||
      url.origin !== from.origin ||
      url.username ||
      url.password ||
      (!allowHash && url.hash) ||
      url.href.length > 1800
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function isSettings(value: Settings) {
  return (
    Number.isInteger(value.steps) &&
    value.steps >= 1 &&
    value.steps <= maxSteps &&
    Number.isInteger(value.delay) &&
    value.delay >= minDelay &&
    value.delay <= maxDelay
  );
}
export function isAction(value: unknown, base: string): value is Action {
  if (
    !value ||
    typeof value !== "object" ||
    !("mode" in value) ||
    !("label" in value) ||
    typeof value.label !== "string" ||
    value.label.length < 1 ||
    value.label.length > 110
  )
    return false;
  if (
    value.mode === "next" ||
    value.mode === "numbered" ||
    value.mode === "url"
  )
    return (
      "href" in value &&
      typeof value.href === "string" &&
      sameWebUrl(value.href, base) === value.href &&
      value.href !== base
    );
  return (
    (value.mode === "more" || value.mode === "scroll") &&
    "key" in value &&
    typeof value.key === "string" &&
    value.key.length > 0 &&
    value.key.length <= 300
  );
}
export function isDynamicResult(
  value: unknown,
): value is "changed" | "no-change" | "unavailable" {
  return (
    value === "changed" || value === "no-change" || value === "unavailable"
  );
}
export function validCapture(value: unknown): value is CollectionResult {
  return isCollectionResult(value);
}
