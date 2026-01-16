import { defineConfig, devices } from '@playwright/test';

/**
 * DevOps AI Dashboard - Playwright E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',
  
  // Test file pattern
  testMatch: '**/*.spec.ts',
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'on-first-retry',
    
    // Timeout for each action
    actionTimeout: 10000,
    
    // Timeout for navigation
    navigationTimeout: 30000,
  },
  
  // Global timeout for each test
  timeout: 60000,
  
  // Configure projects for major browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile devices - iOS
    {
      name: 'iphone-14',
      use: { 
        ...devices['iPhone 14'],
        // Additional mobile settings
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'iphone-14-pro-max',
      use: { 
        ...devices['iPhone 14 Pro Max'],
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'ipad-pro',
      use: { 
        ...devices['iPad Pro 11'],
        hasTouch: true,
        isMobile: true,
      },
    },
    
    // Mobile devices - Android
    {
      name: 'pixel-7',
      use: { 
        ...devices['Pixel 7'],
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'galaxy-s23',
      use: {
        viewport: { width: 360, height: 780 },
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      },
    },
    
    // Tablet
    {
      name: 'galaxy-tab-s8',
      use: {
        viewport: { width: 800, height: 1280 },
        userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-X800) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: false,
      },
    },
  ],
  
  // Run your local dev server before starting the tests
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  
  // Output folder for test artifacts
  outputDir: 'test-results/',
  
  // Expect configuration
  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 10000,
    
    // Visual comparison settings for toHaveScreenshot()
    toHaveScreenshot: {
      // Maximum allowed pixel difference
      maxDiffPixels: 100,
      // Maximum allowed ratio of different pixels (0.01 = 1%)
      maxDiffPixelRatio: 0.01,
      // Threshold for pixel color comparison (0-1, lower = stricter)
      threshold: 0.2,
      // Animation handling
      animations: 'disabled',
    },
    
    // Snapshot settings
    toMatchSnapshot: {
      // Maximum allowed pixel difference for snapshots
      maxDiffPixels: 100,
    },
  },
  
  // Snapshot directory configuration
  snapshotDir: './e2e/snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
});
