import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../tests/e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/sandbox/",
    channel: "chrome",
    headless: true,
  },
  webServer: {
    command: "npm run build && npm run preview -- --config configs/vite.config.ts --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/sandbox/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
