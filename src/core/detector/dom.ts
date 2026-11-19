import { inspectVisibility } from "../analyzer/visibility";
import { maxCellChars } from "./contracts";

export function visibleText(
  root: Element,
  view: Window,
  suppressTables = true,
): string {
  const stack: { node: Node; visible: boolean }[] = [
    { node: root, visible: true },
  ];
  let steps = 0;
  let text = "";
  while (stack.length && steps++ < 64 && text.length < maxCellChars) {
    const entry = stack.pop();
    if (!entry) break;
    const { node, visible } = entry;
    if (node !== root && node.nextSibling)
      stack.push({ node: node.nextSibling, visible });
    if (node.nodeType === 3 && visible)
      text += (node as Text).data.slice(0, maxCellChars - text.length) + " ";
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    if (
      element.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
      (suppressTables && element.localName === "table")
    )
      continue;
    const state = inspectVisibility(element, view);
    if (state !== "prune" && !element.shadowRoot && node.firstChild)
      stack.push({ node: node.firstChild, visible: state === "visible" });
  }
  return text.replace(/\s+/gu, " ").trim().slice(0, maxCellChars);
}

export function safeWebUrl(value: string | null, base: string): string | null {
  if (!value?.trim() || value.length > maxCellChars) return null;
  try {
    const url = new URL(value, base);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      url.href.length <= maxCellChars
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function uniqueLabels(labels: readonly string[]): string[] {
  const used = new Set<string>();
  return labels.map((label) => {
    const text = label.slice(0, 56);
    let final = text;
    for (let n = 2; used.has(final.toLowerCase()); n++) final = `${text} ${n}`;
    used.add(final.toLowerCase());
    return final;
  });
}
