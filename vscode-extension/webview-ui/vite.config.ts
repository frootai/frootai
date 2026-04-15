import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../out/webview",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: "index.html",
        sidebar: "sidebar.html",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-chunk.js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
