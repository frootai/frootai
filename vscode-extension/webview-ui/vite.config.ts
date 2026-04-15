import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Build both entry points as self-contained bundles (no code splitting).
// VS Code webviews have CSP that blocks dynamic imports, so each bundle
// must contain all its dependencies (React, components, etc.) inline.

const entry = process.env.VITE_ENTRY ?? "main";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../out/webview",
    emptyOutDir: entry === "main", // only clean on first build
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, entry === "sidebar" ? "sidebar.html" : "index.html"),
      output: {
        // Force everything into a single chunk per entry
        inlineDynamicImports: true,
        entryFileNames: `${entry}.js`,
        assetFileNames: `${entry}.[ext]`,
      },
    },
  },
});
