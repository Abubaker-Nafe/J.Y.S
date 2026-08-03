import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const shared = {
  baseURL: "http://127.0.0.1:3000",
  headless: process.env.PLAYWRIGHT_HEADED !== "true",
  trace: "on-first-retry" as const,
  screenshot: "only-on-failure" as const,
};
const enableFirefox = process.env.E2E_ENABLE_FIREFOX === "true";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "responsive.spec.ts",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: shared,
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === "true" ? undefined : {
    command: "node node_modules/next/dist/bin/next dev --webpack",
    url: "http://127.0.0.1:3000/en",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium-raw-matrix", use: { ...devices["Desktop Chrome"] } },
    { name: "ios-small-webkit", use: { ...devices["iPhone SE"], browserName: "webkit" } },
    { name: "ios-standard-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
    { name: "ios-large-webkit", use: { ...devices["iPhone 15 Pro Max"], browserName: "webkit" } },
    { name: "android-small-chromium", use: { ...devices["Galaxy S9+"], browserName: "chromium" } },
    { name: "android-standard-chromium", use: { ...devices["Pixel 5"], browserName: "chromium" } },
    { name: "android-large-chromium", use: { ...devices["Galaxy S24"], browserName: "chromium" } },
    { name: "tablet-chromium", use: { browserName: "chromium", viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true } },
    { name: "tablet-webkit", use: { browserName: "webkit", viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true } },
    {
      name: "mobile-firefox",
      testIgnore: enableFirefox ? undefined : /.*/,
      use: {
        browserName: "firefox",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        headless: shared.headless,
      },
    },
  ],
});
