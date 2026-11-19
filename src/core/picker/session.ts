import {
  isPickerCommand,
  maxFields,
  type FieldRule,
  type PickerEvent,
  type PickerPhase,
  type PickerPreview,
} from "./contracts";
import { createOverlay } from "./overlay";
import {
  firstChild,
  getField,
  previewSelection,
  refreshFields,
  selectable,
  suggestRow,
  type PickedField,
} from "./selection";

type EndReason = Extract<PickerEvent, { type: "ended" }>["reason"];

export function startPicker(
  doc: Document,
  view: Window,
  send: (message: PickerEvent) => void,
) {
  const overlay = createOverlay(doc, view);
  const route = view.location.href;
  const abort = new AbortController();
  let phase: PickerPhase = "pick-row";
  let fieldRule: FieldRule = { kind: "text" };
  let hover: Element | null = null;
  let row: Element | null = null;
  let fields: PickedField[] = [];
  let last: PickerPreview | null = null;
  let disposed = false;
  let frame = 0;
  let timer: number | undefined;
  const initialHint =
    "Hover and click an element. For keyboard selection, focus the page, use arrows to move and Enter to pick. Escape cancels.";
  const listeners = { capture: true, signal: abort.signal };
  const observer = new MutationObserver(() => {
    if (timer !== undefined || disposed) return;
    timer = view.setTimeout(() => {
      timer = undefined;
      if (!guard()) return;
      if (row && !selectable(row, view, overlay.host)) {
        row = null;
        fields = [];
        last = null;
        hover = null;
        phase = "pick-row";
        announce("The selected row is no longer available. Pick a new row.");
      } else if (row) {
        const before = fields.length;
        fields = refreshFields(row, fields, view, overlay.host);
        announce(
          phase === "pick-field"
            ? "Pick the field inside the selected row."
            : phase === "pick-row"
              ? initialHint
              : fields.length < before
                ? "A field was removed or hidden by the page; the preview was refreshed."
                : "Page changed; preview refreshed.",
        );
      } else paint();
    }, 120);
  });
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  const heartbeat = view.setInterval(() => {
    guard();
  }, 400);
  const timeout = view.setTimeout(() => end("expired"), 120_000);
  function guard() {
    if (disposed) return false;
    if (view.location.href !== route || !overlay.host.isConnected) {
      end("page-changed");
      return false;
    }
    return true;
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    observer.disconnect();
    view.clearInterval(heartbeat);
    view.clearTimeout(timeout);
    if (timer !== undefined) view.clearTimeout(timer);
    if (frame) view.cancelAnimationFrame(frame);
    overlay.destroy();
    row = null;
    hover = null;
    fields = [];
    last = null;
  }
  function end(reason: EndReason) {
    if (disposed) return;
    const snapshot = reason === "confirmed" ? last : null;
    cleanup();
    send({ v: 1, type: "ended", reason, preview: snapshot });
  }
  function paint() {
    if (frame || disposed) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      overlay.render(hover, row, phase);
    });
  }
  function announce(hint: string) {
    last = row ? previewSelection(row, fields, view, overlay.host) : null;
    paint();
    send({ v: 1, type: "state", state: { phase, hint, preview: last } });
  }
  function setRow(next: Element, hint: string) {
    row = next;
    hover = null;
    fields = [];
    phase = "review";
    announce(hint);
  }
  function pick(element: Element | null) {
    if (!selectable(element, view, overlay.host)) return;
    if (phase === "pick-row") {
      const chosen = suggestRow(element, view, overlay.host);
      setRow(
        chosen,
        chosen === element
          ? "Row selected. Adjust the scope or add fields."
          : "Selected the nearest repeating row around this element. Adjust the scope if needed.",
      );
    } else if (phase === "pick-field" && row) {
      if (!row.contains(element)) {
        announce("Choose a field inside the highlighted row.");
        return;
      }
      const target = fieldRule.kind === "link" ? element.closest("a") : element;
      const field =
        target && getField(row, target, fieldRule, view, overlay.host);
      if (!field) {
        announce(
          "That element has no supported value for this field type. Pick another element.",
        );
        return;
      }
      if (fields.length >= maxFields) {
        phase = "review";
        announce(
          "The field limit was reached. Remove a field before adding another.",
        );
        return;
      }
      fields.push(field);
      phase = "review";
      hover = null;
      announce("Field added. Preview refreshed.");
    }
  }
  function hit(event: Event) {
    const target = event.target;
    return target instanceof Element && selectable(target, view, overlay.host)
      ? target
      : null;
  }
  function suppress(event: Event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function move(event: Event) {
    if (!guard() || phase === "review") return;
    const target = hit(event);
    hover =
      phase === "pick-field" && (!target || !row?.contains(target))
        ? null
        : target;
    paint();
  }
  function suppressIfPicking(event: Event) {
    if (phase !== "review" && guard()) suppress(event);
  }
  view.addEventListener("pointermove", move, listeners);
  view.addEventListener("focusin", move, listeners);
  for (const event of [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "auxclick",
    "contextmenu",
  ])
    view.addEventListener(event, suppressIfPicking, listeners);
  view.addEventListener(
    "click",
    (event) => {
      if (phase === "review" || !guard()) return;
      suppress(event);
      pick(hit(event));
    },
    listeners,
  );
  view.addEventListener(
    "keydown",
    (event) => {
      if (!guard()) return;
      if (event.key === "Escape") {
        suppress(event);
        end("cancelled");
        return;
      }
      if (
        phase === "review" ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (
        ![
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Enter",
          " ",
        ].includes(event.key)
      )
        return;
      suppress(event);
      const start =
        hover ??
        (phase === "pick-field" ? row : null) ??
        doc.querySelector("main") ??
        (doc.body && firstChild(doc.body, view, overlay.host));
      if (!selectable(start, view, overlay.host)) return;
      if (event.key === "Enter" || event.key === " ") {
        pick(start);
        return;
      }
      const target =
        event.key === "ArrowUp"
          ? start.parentElement
          : event.key === "ArrowDown"
            ? firstChild(start, view, overlay.host)
            : event.key === "ArrowLeft"
              ? start.previousElementSibling
              : start.nextElementSibling;
      hover =
        selectable(target, view, overlay.host) &&
        (phase !== "pick-field" || row?.contains(target))
          ? target
          : start;
      paint();
    },
    listeners,
  );
  view.addEventListener("scroll", paint, listeners);
  view.addEventListener("resize", paint, listeners);
  view.addEventListener("pagehide", () => end("page-changed"), listeners);
  view.addEventListener("popstate", guard, listeners);
  view.addEventListener("hashchange", guard, listeners);
  announce(initialHint);
  return {
    cleanup,
    command(message: unknown) {
      if (!guard() || !isPickerCommand(message)) return;
      switch (message.action) {
        case "stop":
          end("cancelled");
          break;
        case "pick-row":
          phase = "pick-row";
          hover = null;
          announce(initialHint);
          break;
        case "parent":
        case "child": {
          const next =
            row &&
            (message.action === "parent"
              ? row.parentElement
              : firstChild(row, view, overlay.host));
          if (selectable(next, view, overlay.host))
            setRow(
              next,
              "Row scope changed. Any previous field choices were cleared.",
            );
          break;
        }
        case "pick-field":
          if (row && fields.length < maxFields) {
            fieldRule = message.rule;
            hover = null;
            phase = "pick-field";
            announce("Pick the field inside the selected row.");
          }
          break;
        case "remove-field":
          fields = fields.filter((_, index) => index !== message.index);
          if (row) {
            phase = "review";
            announce("Field removed.");
          }
          break;
        case "confirm":
          if (selectable(row, view, overlay.host) && phase === "review") {
            fields = refreshFields(row, fields, view, overlay.host);
            last = previewSelection(row, fields, view, overlay.host);
            end("confirmed");
          }
          break;
      }
    },
  };
}
