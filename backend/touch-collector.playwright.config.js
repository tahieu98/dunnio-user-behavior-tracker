'use strict';
module.exports = {
  testDir: './test/browser', testMatch: 'touch-collector.spec.js',
  fullyParallel: false, workers: 1, timeout: 30000,
  use: { headless: true, viewport: { width: 1000, height: 700 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chrome', use: { channel: 'chrome' } }, { name: 'edge', use: { channel: 'msedge' } }],
  reporter: 'list', outputDir: '../test-results/touch-collector'
};
