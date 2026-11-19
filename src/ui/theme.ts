import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";
export type ThemeStore = {
  read(): Promise<unknown>;
  write(theme: Theme): Promise<void>;
};
export const themeKey = "scrapnex.appearance.v1";
export function parseTheme(value: unknown, fallback: Theme): Theme {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : fallback;
}

export function useTheme(store: ThemeStore, fallback: Theme) {
  const [theme, setTheme] = useState<Theme>(fallback);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void store.read().then(
      (value) => {
        if (current) {
          setTheme(parseTheme(value, fallback));
          setLoaded(true);
        }
      },
      () => {
        if (current) {
          setLoaded(true);
          setError("Saved appearance could not be loaded.");
        }
      },
    );
    return () => {
      current = false;
    };
  }, [store, fallback]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  async function choose(next: Theme) {
    if (!loaded || busy || next === theme) return;
    setBusy(true);
    setError("");
    try {
      await store.write(next);
      setTheme(next);
    } catch {
      setError(
        "Appearance could not be saved. Your previous setting is still active.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { theme, busy: busy || !loaded, error, choose };
}
