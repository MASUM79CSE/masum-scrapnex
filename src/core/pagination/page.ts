import { inspectVisibility } from "../analyzer/visibility";
import { visibleText } from "../detector/dom";
import {
  sameWebUrl,
  maxDelay,
  minDelay,
  type Action,
  type DynamicAction,
  type LinkAction,
} from "./contracts";

const landmark =
  '[class~="pagination" i], [class~="pager" i], [data-pagination], nav[aria-label*="pagination" i], [role="navigation"][aria-label*="pagination" i], nav[aria-label*="pages" i]';
const excluded =
  'header, footer, form, dialog, [role="dialog"], [contenteditable]:not([contenteditable="false"]), [inert]';
const blocked =
  /\b(log[ -]?(?:in|out)|sign[ -]?(?:in|out)|buy|checkout|delete|remove|order|pay|search|download|subscribe|cart|captcha|consent|agree|accept|dismiss|verify|account|admin|settings|profile|register|oauth|authenticate)\b/i;
const loading =
  'main[aria-busy="true"], main [aria-busy="true"], [role="main"][aria-busy="true"], [role="main"] [aria-busy="true"]';
const moreLabel =
  /^(?:load|show|see|view) more(?: (?:items|results|products|records|posts|articles|entries))?$/i;
const nextLabel =
  /^(?:next(?: page)?|older (?:posts|articles|entries)|[›»→])$/i;
function rendered(e: Element, view: Window) {
  if (
    e.closest(excluded) ||
    e.matches(':disabled, [aria-disabled="true"], [disabled]')
  )
    return false;
  if (e.getClientRects().length === 0) return false;
  for (
    let p: Element | null = e.parentElement, i = 0;
    p && i < 40;
    p = p.parentElement, i++
  )
    if (inspectVisibility(p, view) === "prune") return false;
  if (e.localName !== "button") return inspectVisibility(e, view) === "visible";
  // Button contents remain excluded from row extraction; only recognize explicit controls here.
  const css = view.getComputedStyle(e);
  return (
    !e.matches('[aria-hidden="true" i], [hidden]') &&
    css.visibility === "visible" &&
    css.opacity !== "0" &&
    css.pointerEvents !== "none" &&
    css.contentVisibility !== "hidden"
  );
}
function buttonText(e: Element, view: Window) {
  let result = "";
  let n = 0;
  for (
    let child = e.firstChild;
    child && n++ < 20 && result.length < 100;
    child = child.nextSibling
  ) {
    if (child.nodeType === 3)
      result += (child as Text).data.slice(0, 100 - result.length) + " ";
    else if (
      child.nodeType === 1 &&
      inspectVisibility(child as Element, view) === "visible"
    )
      result +=
        visibleText(child as Element, view).slice(0, 100 - result.length) + " ";
  }
  return result.trim();
}
function label(e: Element, view: Window) {
  return (
    e.getAttribute("aria-label")?.trim() ||
    (e.localName === "button" ? buttonText(e, view) : visibleText(e, view)) ||
    e.getAttribute("title")?.trim() ||
    ""
  )
    .replace(/\s+/g, " ")
    .slice(0, 96);
}
function number(s: string) {
  return /^(?:page )?\d{1,5}$/i.test(s)
    ? Number(s.replace(/^page /i, ""))
    : null;
}
function orderedUrl(from: string, to: string) {
  const a = new URL(from),
    b = new URL(to);
  if (a.pathname !== b.pathname) return false;
  for (const name of ["page", "paged", "p"]) {
    const next = b.searchParams.getAll(name);
    const prev = a.searchParams.getAll(name);
    if (next.length !== 1 || prev.length > 1) continue;
    const index = number(prev[0] ?? "1");
    const choice = number(next[0] ?? "");
    if (index === null || choice !== index + 1) continue;
    const aa = new URLSearchParams(a.search),
      bb = new URLSearchParams(b.search);
    aa.delete(name);
    bb.delete(name);
    aa.sort();
    bb.sort();
    if (aa.toString() === bb.toString()) return true;
  }
  return false;
}
function linkUrl(e: Element, view: Window) {
  if (
    e.hasAttribute("download") ||
    e.hasAttribute("ping") ||
    e.hasAttribute("onclick") ||
    (e.hasAttribute("target") &&
      e.getAttribute("target")?.toLowerCase() !== "_self")
  )
    return null;
  const href = sameWebUrl(e.getAttribute("href"), view.location.href);
  if (!href || href === view.location.href) return null;
  try {
    if (blocked.test(decodeURIComponent(new URL(href).pathname))) return null;
  } catch {
    return null;
  }
  return href;
}
function forElements(doc: Document, visit: (element: Element) => void) {
  const walker = doc.createTreeWalker(doc.body, 1);
  for (let i = 0; i < 50_000; i++) {
    const element = walker.nextNode() as Element | null;
    if (!element) break;
    if (element.localName === "a" || element.localName === "button")
      visit(element);
  }
}
function busy(doc: Document, view: Window) {
  const marker = doc.querySelector(loading);
  return !!marker && rendered(marker, view);
}
function unique<T>(values: Map<string, T>) {
  return values.size === 1 ? (values.values().next().value as T) : undefined;
}
function inspect(doc: Document) {
  const view = doc.defaultView;
  const controls: Action[] = [];
  if (!view || !doc.body || view !== view.top) return { controls };
  const forward = new Map<string, LinkAction>(),
    nums = new Map<string, LinkAction>(),
    urls = new Map<string, LinkAction>(),
    buttons = new Map<string, HTMLButtonElement>();
  let moreCount = 0;
  const pageNumbers = new WeakMap<Element, number | null>();
  const add = (
    set: Map<string, LinkAction>,
    mode: LinkAction["mode"],
    name: string,
    href: string,
  ) => set.set(href, { mode, label: name, href });
  forElements(doc, (element) => {
    if (element.localName === "a" && !element.hasAttribute("href")) return;
    const parent = element.closest(landmark);
    const rel = element
      .getAttribute("rel")
      ?.toLowerCase()
      .split(/\s+/)
      .includes("next");
    if (element.localName === "a" && !parent && !rel) return;
    if (
      element.localName === "button" &&
      !element.closest('main,[role="main"]')
    )
      return;
    const name = label(element, view);
    const more =
      element.localName === "button" &&
      moreLabel.test(name) &&
      !!element.closest('main,[role="main"]') &&
      !element.closest('article,[role="article"]');
    if (
      (!more && !parent && !rel) ||
      !rendered(element, view) ||
      blocked.test(name)
    )
      return;
    if (more) {
      const button = element as HTMLButtonElement;
      if (
        button.form ||
        button.hasAttribute("form") ||
        button.hasAttribute("formaction") ||
        button.hasAttribute("popovertarget")
      )
        return;
      moreCount++;
      buttons.set(name.toLowerCase(), button);
      return;
    }
    if (element.localName !== "a") return;
    const href = linkUrl(element, view);
    if (!href) return;
    if (rel || (parent && nextLabel.test(name)))
      add(forward, "next", name || "Next page (rel=next)", href);
    if (parent) {
      if (!pageNumbers.has(parent)) {
        const current = parent.querySelectorAll(
          '[aria-current="page"], [aria-current="true"]',
        );
        pageNumbers.set(
          parent,
          current.length === 1 && current[0]
            ? number(label(current[0], view))
            : null,
        );
      }
      const at = pageNumbers.get(parent) ?? null;
      if (at !== null && number(name) === at + 1)
        add(nums, "numbered", `Page ${at + 1}`, href);
      if (orderedUrl(view.location.href, href))
        add(urls, "url", `Next URL page (${name || "linked page"})`, href);
    }
  });
  // Head metadata is allowed only when it describes the very same safe origin.
  for (const head of Array.from(doc.head?.children ?? []).slice(0, 100)) {
    if (
      head.localName !== "link" ||
      !head.getAttribute("rel")?.toLowerCase().split(/\s+/).includes("next")
    )
      continue;
    const href = linkUrl(head, view);
    if (href && !forward.has(href))
      add(forward, "next", "Next page (rel=next metadata)", href);
  }
  for (const match of [unique(forward), unique(nums), unique(urls)])
    if (match) controls.push(match);
  const button = moreCount === 1 ? unique(buttons) : undefined;
  if (button) {
    const name = label(button, view);
    controls.push({ mode: "more", label: name, key: name.toLowerCase() });
  }
  if ((doc.scrollingElement?.scrollHeight ?? 0) > view.innerHeight + 32)
    controls.push({
      mode: "scroll",
      label: "Scroll the page viewport",
      key: "viewport",
    });
  return { controls, button };
}
export function detectActions(doc: Document) {
  return inspect(doc).controls;
}

/** One authorized DOM interaction; refuse to repeat before content settles. */
export async function actOnPage(
  doc: Document,
  action: DynamicAction,
  delay: number,
) {
  const view = doc.defaultView;
  if (!view || delay < minDelay || delay > maxDelay || !Number.isInteger(delay))
    return "unavailable" as const;
  const current = inspect(doc);
  if (
    !current.controls.some(
      (candidate) =>
        candidate.mode === action.mode &&
        "key" in candidate &&
        candidate.key === action.key,
    ) ||
    busy(doc, view) ||
    !!doc.querySelector('dialog[open], [aria-modal="true"]')
  )
    return "unavailable" as const;
  const area = doc.querySelector('main,[role="main"]') ?? doc.body;
  if (!area) return "unavailable" as const;
  const href = view.location.href;
  const previousY = view.scrollY;
  const start = performance.now(),
    deadline = start + Math.min(8500, delay + 3500);
  let lastMutation = start,
    contentChanged = false;
  const observer = new MutationObserver((changes) => {
    lastMutation = performance.now();
    if (
      changes.some(
        (mutation) =>
          mutation.type === "childList" || mutation.type === "characterData",
      )
    )
      contentChanged = true;
  });
  observer.observe(area, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-busy", "disabled", "aria-disabled", "hidden"],
  });
  try {
    if (action.mode === "more") {
      if (!current.button || !current.button.isConnected)
        return "unavailable" as const;
      current.button.click();
    } else
      view.scrollBy({
        top: Math.max(120, Math.floor(view.innerHeight * 0.8)),
        behavior: "instant",
      });
    while (performance.now() < deadline) {
      await new Promise<void>((resolve) => view.setTimeout(resolve, 125));
      if (view.location.href !== href || !area.isConnected)
        return "unavailable" as const;
      const now = performance.now();
      if (
        now - start >= delay &&
        !busy(doc, view) &&
        now - lastMutation >= 375 &&
        (contentChanged ||
          (action.mode === "scroll" &&
            now - start >= delay + 750 &&
            view.scrollY > previousY + 1))
      )
        return "changed" as const;
    }
    return "no-change" as const;
  } finally {
    observer.disconnect();
  }
}
