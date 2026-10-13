import { defineConfig } from '@playwright/test';

// Pinned Playwright disables automatic DOM error snapshots, which could expose native QR/recovery values.
process.env['PLAYWRIGHT_NO_COPY_PROMPT']='1';
process.env['DEBUG']='';

export default defineConfig({ testDir: './tests', retries: 0, workers: 1, use: { ignoreHTTPSErrors: false, trace: 'off', screenshot: 'off', video: 'off' }, reporter: 'line' });
