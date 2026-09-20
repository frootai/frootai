import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: '../../.artifacts/playwright',
  snapshotPathTemplate: '{testDir}/golden/{arg}{ext}',
  reporter: 'line',
  use: {
    baseURL: process.env.ACO_BASE_URL ?? 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
})