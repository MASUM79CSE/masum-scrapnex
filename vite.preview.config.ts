import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./preview", import.meta.url)),
  server: {
    allowedHosts: [".e2b.app"],
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
  },
  plugins: [tailwindcss()],
});
