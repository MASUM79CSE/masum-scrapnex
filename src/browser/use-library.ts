import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import type { DetectedCandidate } from "../core/detector/contracts";
import type { Dataset } from "../core/extraction/contracts";
import {
  defaultStorageSettings,
  newRecipe,
  storageSettingsKey,
  type CleanupDays,
  type Recipe,
  type SavedSession,
  type SessionSummary,
  type StorageSettings,
  type WorkflowDefaults,
} from "../core/library/contracts";
import { createLibrary } from "./library";
import { localLibraryPreferences } from "./preferences";

const library = createLibrary();
export interface LibraryView {
  sessions: SessionSummary[];
  recipes: Recipe[];
  bytes: number;
  busy: boolean;
  loading: boolean;
  settings: StorageSettings;
  defaults: (settings: WorkflowDefaults) => void;
  error: string;
  message: string;
  refresh: () => void;
  save: (name: string, data: Dataset, partial: boolean) => void;
  restore: (id: string, apply: (item: SavedSession) => boolean) => void;
  recipe: (name: string, origin: string, candidate: DetectedCandidate) => void;
  remove: (id: string) => void;
  removeRecipe: (id: string) => void;
  clearHistory: () => void;
  clearRecipes: () => void;
  clean: () => void;
  setDays: (days: CleanupDays) => void;
}
const empty = {
  sessions: [] as SessionSummary[],
  recipes: [] as Recipe[],
  bytes: 0,
};
function problem(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "QuotaExceededError")
      return "Browser storage is full. Remove saved items and try again.";
    return "Local storage is unavailable or the operation was interrupted.";
  }
  return error instanceof Error
    ? error.message
    : "The local storage action failed.";
}
export function useLibrary(): LibraryView {
  const [data, setData] = useState(empty),
    [settings, setSettings] = useState(defaultStorageSettings);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const mounted = useRef(false),
    writing = useRef(false),
    epoch = useRef(0);
  async function reload() {
    const token = ++epoch.current;
    const results = await Promise.allSettled([
      library.readLibrary(),
      localLibraryPreferences.read(),
    ]);
    if (!mounted.current || token !== epoch.current) return;
    const [items, prefs] = results;
    setLoading(false);
    if (items.status === "fulfilled") setData(items.value);
    else setError(problem(items.reason));
    if (prefs.status === "fulfilled") setSettings(prefs.value);
    else setError(problem(prefs.reason));
  }
  useEffect(() => {
    mounted.current = true;
    void reload();
    const changed: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area === "local" && Object.hasOwn(changes, storageSettingsKey))
        void reload();
    };
    browser.storage.onChanged.addListener(changed);
    return () => {
      mounted.current = false;
      epoch.current++;
      browser.storage.onChanged.removeListener(changed);
    };
  }, []);
  async function execute(work: () => Promise<string>) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const note = await work();
      if (mounted.current) {
        setMessage(note);
        await reload();
      }
    } catch (error) {
      if (mounted.current) setError(problem(error));
    } finally {
      writing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    ...data,
    settings,
    busy,
    loading,
    error,
    message,
    refresh() {
      setError("");
      setMessage("");
      setLoading(true);
      void reload();
    },
    save: (name, dataset, partial) =>
      void execute(async () => {
        const item = await library.save(name, dataset, partial);
        return `Saved snapshot “${item.name}” on this device.`;
      }),
    restore: (id, apply) =>
      void execute(async () => {
        const item = await library.restore(id);
        if (!apply(item))
          throw new Error(
            "A working dataset is already open or a collection is active. Finish or discard it before restoring.",
          );
        return `Restored “${item.name}”.`;
      }),
    recipe: (name, origin, candidate) =>
      void execute(async () => {
        const item = newRecipe(
          name,
          origin,
          candidate,
          crypto.randomUUID(),
          Date.now(),
        );
        await library.addRecipe(item);
        return `Saved configuration “${item.name}”.`;
      }),
    remove: (id) =>
      void execute(async () => {
        await library.remove(id);
        return "Snapshot deleted.";
      }),
    removeRecipe: (id) =>
      void execute(async () => {
        await library.removeRecipe(id);
        return "Configuration deleted.";
      }),
    clearHistory: () =>
      void execute(async () => {
        await library.clearHistory();
        return "Local snapshot history cleared.";
      }),
    clearRecipes: () =>
      void execute(async () => {
        await library.clearRecipes();
        return "Saved configurations cleared.";
      }),
    clean: () =>
      void execute(async () => {
        const days = settings.cleanupDays;
        const n = await library.cleanup(days);
        return `Removed ${n} ${n === 1 ? "snapshot" : "snapshots"} older than ${days} days.`;
      }),
    defaults: (next) =>
      void execute(async () => {
        await localLibraryPreferences.write(next);
        return "Workflow defaults saved on this device.";
      }),
    setDays: (next) =>
      void execute(async () => {
        await localLibraryPreferences.write({ cleanupDays: next });
        return "Cleanup preference saved on this device.";
      }),
  };
}
