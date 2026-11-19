const excludedTags = new Set([
  "script",
  "style",
  "link",
  "meta",
  "noscript",
  "template",
  "iframe",
  "frame",
  "object",
  "embed",
  "canvas",
  "svg",
  "input",
  "textarea",
  "select",
  "option",
  "button",
  "datalist",
  "form",
]);

/** Deliberately does not use viewport intersections or force geometry/layout reads. */
export function inspectVisibility(
  element: Element,
  view: Window,
): "prune" | "hidden" | "visible" {
  const tag = element.localName;
  if (
    excludedTags.has(tag) ||
    element.hasAttribute("hidden") ||
    element.hasAttribute("inert") ||
    element.hasAttribute("contenteditable") ||
    element.getAttribute("aria-hidden")?.toLowerCase() === "true"
  )
    return "prune";
  const css = view.getComputedStyle(element);
  if (
    css.display === "none" ||
    css.contentVisibility === "hidden" ||
    css.opacity === "0"
  )
    return "prune";
  // A descendant may explicitly override inherited visibility.
  if (css.visibility === "hidden" || css.visibility === "collapse")
    return "hidden";
  return "visible";
}
