import { useRef, useState } from "react";
import { browser } from "wxt/browser";
import type { ScanBinding } from "./ports";
import { parseQueue } from "./url-queue";

type Entry = {
  href: string;
  status: "pending" | "opened" | "collected" | "partial" | "skipped";
  tabId?: number;
};
export function useUrlQueue() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const opening = useRef(false);
  const current = useRef<Entry[]>([]);
  function update(next: Entry[]) {
    current.current = next;
    setEntries(next);
  }
  const first = entries.find(
    (item) => item.status === "pending" || item.status === "opened",
  );
  function load(input: string) {
    if (opening.current) return;
    setError("");
    try {
      update(parseQueue(input).map((href) => ({ href, status: "pending" })));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not prepare this queue.",
      );
    }
  }
  function clear() {
    if (!opening.current) {
      update([]);
      setError("");
    }
  }
  async function openNext(href: string) {
    if (
      opening.current ||
      !first ||
      first.href !== href ||
      first.status !== "pending" ||
      !current.current.includes(first)
    )
      return;
    opening.current = true;
    setBusy(true);
    setError("");
    try {
      const tab = await browser.tabs.create({ url: href, active: true });
      if (tab.id === undefined) throw new Error();
      const tabId = tab.id;
      update(
        current.current.map((item) =>
          item === first ? { href, status: "opened", tabId } : item,
        ),
      );
    } catch {
      setError("Could not open this URL. No collection was started.");
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }
  function mark(href: string, retry: boolean) {
    if (
      opening.current ||
      !first ||
      first.href !== href ||
      !current.current.includes(first)
    )
      return;
    update(
      current.current.map((item) =>
        item === first ? { href, status: retry ? "pending" : "skipped" } : item,
      ),
    );
  }
  function collected(binding: ScanBinding, partial: boolean) {
    // Redirects, different tabs, pagination and restores cannot complete a queue entry.
    const match = current.current.find(
      (item) =>
        item.status === "opened" &&
        item.tabId === binding.tabId &&
        item.href === binding.href,
    );
    if (match)
      update(
        current.current.map((item) =>
          item === match
            ? { href: item.href, status: partial ? "partial" : "collected" }
            : item,
        ),
      );
  }
  return {
    entries,
    first,
    busy,
    error,
    load,
    clear,
    openNext,
    mark,
    collected,
  };
}
export type UrlQueueView = ReturnType<typeof useUrlQueue>;
