import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "MASUM SCRAPNEXS",
    description:
      "An independent, local-first workspace for structured web data.",
    minimum_chrome_version: "116",
    icons: {
      16: "icons/16.png",
      32: "icons/32.png",
      48: "icons/48.png",
      128: "icons/128.png",
    },
    permissions: ["activeTab", "scripting", "storage"],
    action: { default_title: "MASUM SCRAPNEXS" },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
