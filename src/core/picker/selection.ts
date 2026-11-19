import type { RowPlan } from "../extraction/collect";
import { similarity, type Shape } from "../analyzer/shape";
import { inspectVisibility } from "../analyzer/visibility";
import { maxCellChars } from "../detector/contracts";
import { safeWebUrl, uniqueLabels, visibleText } from "../detector/dom";
import { maxRows, type FieldRule, type PickerPreview } from "./contracts";

const html = "http://www.w3.org/1999/xhtml";
const siblingLimit = 128;
const relativeLimit = 12;
interface Step {
  tag: string;
  nth: number;
}
export interface PickedField {
  anchor: Element;
  rule: FieldRule;
  path: Step[];
}

function safeTag(element: Element) {
  return /^[a-z][a-z0-9-]{0,31}$/.test(element.localName)
    ? element.localName
    : "";
}

export function selectable(
  element: Element | null,
  view: Window,
  host?: Element,
): element is Element {
  if (
    !element ||
    !element.isConnected ||
    element === host ||
    element === element.ownerDocument.body ||
    element === element.ownerDocument.documentElement ||
    element.getRootNode() !== element.ownerDocument ||
    !safeTag(element) ||
    element.shadowRoot
  )
    return false;
  let current: Element | null = element;
  let depth = 0;
  while (current && depth++ < 64) {
    if (
      current.namespaceURI !== html ||
      current === host ||
      current.hasAttribute("contenteditable") ||
      inspectVisibility(current, view) === "prune"
    )
      return false;
    current = current.parentElement;
  }
  return !current && inspectVisibility(element, view) === "visible";
}

export function firstChild(element: Element, view: Window, host?: Element) {
  let child = element.firstElementChild;
  for (let index = 0; child && index < 32; index++) {
    const next: Element | null = child.nextElementSibling;
    if (selectable(child, view, host)) return child;
    child = next;
  }
  return null;
}

function nthStep(element: Element): Step | null {
  const tag = safeTag(element);
  if (!tag) return null;
  let nth = 1;
  let steps = 0;
  let previous = element.previousElementSibling;
  while (previous && steps++ < siblingLimit) {
    if (previous.localName === tag) nth++;
    previous = previous.previousElementSibling;
  }
  return previous ? null : { tag, nth };
}
function selector(path: readonly Step[]) {
  return path.map(({ tag, nth }) => `${tag}:nth-of-type(${nth})`).join(" > ");
}
function relative(root: Element, leaf: Element): Step[] | null {
  const path: Step[] = [];
  let current: Element | null = leaf;
  while (current && current !== root && path.length < relativeLimit) {
    const step = nthStep(current);
    if (!step) return null;
    path.unshift(step);
    current = current.parentElement;
  }
  return current === root ? path : null;
}
function absolute(element: Element) {
  const root = element.ownerDocument.body;
  const parts = root && relative(root, element);
  return parts
    ? `body > ${selector(parts)}`
    : `<${safeTag(element)}> · exact path exceeds inspection limits`;
}
function resolve(root: Element, path: readonly Step[]): Element | null {
  let current = root;
  for (const part of path) {
    let found: Element | null = null;
    let seen = 0;
    let child = current.firstElementChild;
    for (
      let index = 0;
      child && index <= siblingLimit;
      index++, child = child.nextElementSibling
    ) {
      if (child.localName === part.tag && ++seen === part.nth) {
        found = child;
        break;
      }
    }
    if (!found) return null;
    current = found;
  }
  return current;
}
function fingerprint(element: Element, view: Window): Shape {
  const tokens = new Map<string, number>();
  function add(key: string) {
    tokens.set(key, (tokens.get(key) ?? 0) + 1);
  }
  let child = element.firstElementChild;
  for (let n = 0; child && n < 10; n++, child = child.nextElementSibling) {
    if (inspectVisibility(child, view) !== "visible") continue;
    const childTag = safeTag(child);
    if (!childTag) continue;
    add(`1/${childTag}`);
    let leaf = child.firstElementChild;
    for (let j = 0; leaf && j < 3; j++, leaf = leaf.nextElementSibling) {
      if (inspectVisibility(leaf, view) === "visible" && safeTag(leaf))
        add(`2/${childTag}/${safeTag(leaf)}`);
    }
  }
  return { root: element.localName, tokens };
}
export function similarRows(row: Element, view: Window, host?: Element) {
  const shape = fingerprint(row, view);
  const peers: Element[] = [];
  let child = row.parentElement?.firstElementChild ?? null;
  for (
    let n = 0;
    child && n < siblingLimit;
    n++, child = child.nextElementSibling
  ) {
    if (
      child === row ||
      (row.localName === child.localName &&
        selectable(child, view, host) &&
        similarity(shape, fingerprint(child, view)) >= 0.64)
    )
      peers.push(child);
  }
  // Keep the explicit click even if it falls outside the bounded sibling window.
  if (!peers.includes(row)) peers.unshift(row);
  const sample = [row, ...peers.filter((peer) => peer !== row)].slice(
    0,
    maxRows,
  );
  return { observed: peers.length, sampled: !!child, sample };
}
export function suggestRow(element: Element, view: Window, host?: Element) {
  let current = element;
  for (let step = 0; step < 4; step++) {
    if (similarRows(current, view, host).observed >= 2) return current;
    const parent = current.parentElement;
    if (!selectable(parent, view, host) || parent.localName === "main") break;
    current = parent;
  }
  return element;
}
export function getField(
  row: Element,
  element: Element,
  rule: FieldRule,
  view: Window,
  host?: Element,
): PickedField | null {
  const path = relative(row, element);
  if (!path || readField(element, rule, view, host) === null) return null;
  return { anchor: element, rule, path };
}
function readField(
  element: Element | null,
  rule: FieldRule,
  view: Window,
  host?: Element,
): string | null {
  if (!selectable(element, view, host)) return null;
  if (rule.kind === "text") return visibleText(element, view);
  if (rule.kind === "link")
    return element.localName === "a"
      ? safeWebUrl(element.getAttribute("href"), element.ownerDocument.baseURI)
      : null;
  if (rule.kind === "image" || rule.kind === "alt") {
    if (element.localName !== "img") return null;
    if (rule.kind === "image")
      return safeWebUrl(
        (element as HTMLImageElement).currentSrc || element.getAttribute("src"),
        element.ownerDocument.baseURI,
      );
    return element.getAttribute("alt")?.slice(0, maxCellChars) ?? null;
  }
  return rule.kind === "attribute"
    ? (element.getAttribute(rule.attribute)?.slice(0, maxCellChars) ?? null)
    : null;
}
function label(rule: FieldRule) {
  return rule.kind === "attribute"
    ? rule.attribute
    : (
        {
          text: "Text",
          link: "Link URL",
          image: "Image URL",
          alt: "Image alt text",
        } as const
      )[rule.kind];
}
export function refreshFields(
  row: Element,
  fields: readonly PickedField[],
  view: Window,
  host?: Element,
) {
  return fields.flatMap((field) => {
    const next = getField(row, field.anchor, field.rule, view, host);
    return next ? [next] : [];
  });
}
export function previewSelection(
  row: Element,
  fields: readonly PickedField[],
  view: Window,
  host?: Element,
): PickerPreview {
  const matched = similarRows(row, view, host);
  const rules: readonly PickedField[] = fields.length
    ? fields
    : [{ anchor: row, path: [], rule: { kind: "text" } }];
  const names = uniqueLabels(rules.map(({ rule }) => label(rule)));
  return {
    selector: absolute(row),
    observed: matched.observed,
    sampled: matched.sampled,
    canParent: selectable(row.parentElement, view, host),
    canChild: !!firstChild(row, view, host),
    columns: rules.map(({ path }, index) => ({
      label: names[index] ?? `Field ${index + 1}`,
      selector: path.length ? selector(path) : ":scope",
    })),
    rows: matched.sample.map((sample) =>
      rules.map(({ path, rule }) =>
        readField(resolve(sample, path), rule, view, host),
      ),
    ),
    explicitFields: fields.length > 0,
  };
}

export function manualPlan(
  row: Element,
  fields: readonly PickedField[],
  view: Window,
  host?: Element,
): RowPlan {
  const rules: readonly PickedField[] = fields.length
    ? fields
    : [{ anchor: row, path: [], rule: { kind: "text" } }];
  const names = uniqueLabels(rules.map(({ rule }) => label(rule)));
  const shape = fingerprint(row, view);
  return {
    columns: rules.map(({ rule }, index) => ({
      id: `c${index + 1}`,
      label: names[index] ?? `Field ${index + 1}`,
      kind:
        rule.kind === "link" ? "url" : rule.kind === "image" ? "image" : "text",
    })),
    rows: (function* () {
      // Yield every sibling (including nonmatches) so the capture budget counts all visits.
      const tuple = (element: Element) =>
        rules.map(({ path, rule }) =>
          readField(resolve(element, path), rule, view, host),
        );
      yield tuple(row);
      let peer = row.parentElement?.firstElementChild ?? null;
      while (peer) {
        const current = peer;
        peer = peer.nextElementSibling;
        yield current !== row &&
        current.localName === row.localName &&
        selectable(current, view, host) &&
        similarity(shape, fingerprint(current, view)) >= 0.64
          ? tuple(current)
          : null;
      }
    })(),
  };
}
