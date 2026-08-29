import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const projectDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));

for (const entry of ["main", "sidebar"]) {
  await build({
    configFile: false,
    root: projectDirectory,
    plugins: [react()],
    build: {
      outDir: resolve(projectDirectory, "../out/webview"),
      emptyOutDir: entry === "main",
      cssCodeSplit: false,
      rollupOptions: {
        input: resolve(projectDirectory, entry === "sidebar" ? "sidebar.html" : "index.html"),
        output: {
          inlineDynamicImports: true,
          entryFileNames: `${entry}.js`,
          assetFileNames: `${entry}.[ext]`,
        },
      },
    },
  });
}