import { useEffect } from "react";

/**
 * Escape dismisses the disclosure sheet the user is working in and returns focus
 * to its summary.
 *
 * `<details>` has no dismissal of its own: once open, the only way out is to
 * find the summary again. The Apple language treats every overlay as dismissable
 * from the keyboard, so this is a gate (G9), not a nicety.
 *
 * Scope is deliberately narrow — only a sheet that contains the focused element
 * is closed, so Escape never closes something the user is not looking at.
 */
export function useDismissableSheets() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (!active) return;
      const sheet = Array.from(
        document.querySelectorAll<HTMLDetailsElement>("details[open]"),
      ).find((details) => details.contains(active));
      if (!sheet) return;
      event.preventDefault();
      sheet.open = false;
      sheet.querySelector<HTMLElement>("summary")?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
