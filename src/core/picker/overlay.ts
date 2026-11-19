/** An isolated, pointer-transparent overlay. No page element's attributes are edited. */
export function createOverlay(doc: Document, view: Window) {
  const host = doc.createElement("div");
  host.setAttribute("data-masum-picker-overlay", "");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "all:initial!important;position:fixed!important;inset:0!important;display:block!important;pointer-events:none!important;z-index:2147483647!important;";
  const shadow = host.attachShadow({ mode: "closed" });
  const css = new CSSStyleSheet();
  css.replaceSync(
    ":host,*{pointer-events:none!important}.box{position:fixed;box-sizing:border-box;border:2px dashed #20b894;background:#45d8b424;border-radius:5px}.chosen{border:2px solid #e7a631;background:#ffe67a24}.label{position:fixed;padding:5px 8px;background:#102330;color:#fff;border:1px solid #49dbb7;border-radius:5px;font:600 12px system-ui;white-space:nowrap}[hidden]{display:none!important}",
  );
  shadow.adoptedStyleSheets = [css];
  const current = doc.createElement("div");
  current.className = "box";
  current.hidden = true;
  const chosen = doc.createElement("div");
  chosen.className = "box chosen";
  chosen.hidden = true;
  const label = doc.createElement("div");
  label.className = "label";
  label.hidden = true;
  shadow.append(chosen, current, label);
  doc.documentElement.append(host);
  function draw(node: HTMLElement, element: Element | null) {
    node.hidden = true;
    if (!element?.isConnected) return null;
    const rect = element.getBoundingClientRect();
    if (
      !rect.width ||
      !rect.height ||
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left >= view.innerWidth ||
      rect.top >= view.innerHeight
    )
      return null;
    node.style.left = `${rect.left}px`;
    node.style.top = `${rect.top}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    node.hidden = false;
    return rect;
  }
  return {
    host,
    render(
      hover: Element | null,
      selected: Element | null,
      mode: "pick-row" | "pick-field" | "review",
    ) {
      const selectedRect = draw(chosen, selected);
      const hoverRect = draw(current, mode === "review" ? null : hover);
      const anchor = hoverRect ?? selectedRect;
      label.hidden = !anchor;
      if (!anchor) return;
      const tag = (hoverRect ? hover : selected)?.localName ?? "";
      label.textContent = hoverRect
        ? `Pick ${mode === "pick-field" ? "field" : "row"} · ${tag}`
        : `Selected row · ${tag}`;
      label.style.left = `${Math.max(3, Math.min(view.innerWidth - 180, anchor.left + 4))}px`;
      label.style.top = `${Math.max(3, Math.min(view.innerHeight - 28, anchor.top - 26))}px`;
    },
    destroy() {
      host.remove();
    },
  };
}
