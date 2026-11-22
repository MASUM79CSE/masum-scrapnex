import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// The UI badge and diagnostics read the real release version, never a hard-coded string.
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

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
  vite: () => ({
    plugins: [tailwindcss()],
    define: { __PRODUCT_VERSION__: JSON.stringify(version) },
  }),
});
