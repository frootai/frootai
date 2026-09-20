import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(() => {
  const target = process.env.ACO_PROXY_TARGET ?? 'http://127.0.0.1:8080'
  const proxy = {
    target,
    changeOrigin: true,
    ...(target.startsWith('https://') ? { headers: { origin: target } } : {}),
  }
  return {
    plugins: [react()],
    build: {
      outDir: '../AzureCostOptimizer.App/wwwroot',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': proxy,
        '/auth': proxy,
        '/health': proxy,
      },
    },
  }
})
