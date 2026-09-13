import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/serve-fixture.mjs',
    url: 'http://localhost:3123/fixture.html',
    reuseExistingServer: true,
    stdout: 'ignore',
  },
});
