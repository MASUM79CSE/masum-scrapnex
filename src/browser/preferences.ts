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
