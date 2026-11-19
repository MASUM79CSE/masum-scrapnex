import {
  parseStorageSettings,
  storageSettingsKey,
  type StorageSettings,
} from "../core/library/contracts";
import { browser } from "wxt/browser";
import { themeKey, type ThemeStore } from "../ui/theme";

export const extensionThemeStore: ThemeStore = {
  async read() {
    return (await browser.storage.local.get(themeKey))[themeKey];
  },
  async write(theme) {
    await browser.storage.local.set({ [themeKey]: theme });
  },
};

export const localLibraryPreferences = {
  async read() {
    const raw: unknown = (await browser.storage.local.get(storageSettingsKey))[
      storageSettingsKey
    ];
    const next = parseStorageSettings(raw);
    if (raw && typeof raw === "object" && "version" in raw && raw.version === 1)
      await browser.storage.local.set({ [storageSettingsKey]: next });
    return next;
  },
  async write(values: Partial<Omit<StorageSettings, "version">>) {
    const raw: unknown = (await browser.storage.local.get(storageSettingsKey))[
      storageSettingsKey
    ];
    const next = parseStorageSettings({
      ...parseStorageSettings(raw),
      ...values,
    });
    await browser.storage.local.set({ [storageSettingsKey]: next });
  },
};
