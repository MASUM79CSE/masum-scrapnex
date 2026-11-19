import { mount } from "../src/styles/mount";
import { themeKey, type ThemeStore } from "../src/ui/theme";
import { Workspace } from "../src/ui/workspace";

const previewThemeStore: ThemeStore = {
  async read() {
    return localStorage.getItem(themeKey);
  },
  async write(theme) {
    localStorage.setItem(themeKey, theme);
  },
};

mount(<Workspace mode="preview" themeStore={previewThemeStore} />);
