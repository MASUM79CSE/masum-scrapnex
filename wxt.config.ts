import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "MASUM SCRAPNEX",
    description:
      "An independent, local-first workspace for structured web data.",
    minimum_chrome_version: "116",
    permissions: ["activeTab", "scripting", "storage"],
    action: { default_title: "MASUM SCRAPNEX" },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
