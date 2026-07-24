import { defineConfig, devices } from '@playwright/test';

const ciChromiumLaunchOptions = process.env.CI
  ? {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
  }
  : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'artifacts/playwright',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['line'],
    [
      'html',
      {
        outputFolder: 'artifacts/playwright-report',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    video: process.env.CI ? 'off' : 'retain-on-failure',
  },
  webServer: {
    command: [
      'npm run dev --',
      '--host 127.0.0.1',
      '--port 4173',
      '--strictPort',
    ].join(' '),
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chrome',
      testMatch: /tier1|visual/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: ciChromiumLaunchOptions,
      },
    },
    {
      name: 'msedge',
      testMatch: /tier1/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge',
        launchOptions: ciChromiumLaunchOptions,
      },
    },
    {
      name: 'firefox',
      testMatch: /smoke/,
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: process.env.CI
          ? {
            firefoxUserPrefs: {
              'webgl.force-enabled': true,
            },
          }
          : undefined,
      },
    },
    {
      name: 'webkit',
      testMatch: /smoke/,
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],
});
