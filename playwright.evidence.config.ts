import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'artifacts/evidence',
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['line'],
    [
      'html',
      {
        outputFolder: 'artifacts/evidence-report',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'on',
    trace: 'on',
    video: {
      mode: 'on',
      size: {
        width: 1440,
        height: 900,
      },
    },
    viewport: {
      width: 1440,
      height: 900,
    },
  },
  webServer: {
    command: [
      'npm run dev --',
      '--host 127.0.0.1',
      '--port 4173',
      '--strictPort',
    ].join(' '),
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chrome',
      testMatch: /tier1/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: {
          width: 1440,
          height: 900,
        },
      },
    },
  ],
});
