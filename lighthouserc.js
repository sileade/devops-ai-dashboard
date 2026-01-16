/**
 * Lighthouse CI Configuration
 * 
 * This configuration defines performance budgets and audit settings
 * for automated Lighthouse testing in CI/CD pipeline.
 * 
 * Run locally: npx lhci autorun
 * Run specific audit: npx lhci collect --url=http://localhost:3000
 */

module.exports = {
  ci: {
    collect: {
      // URLs to audit
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/containers',
        'http://localhost:3000/kubernetes',
        'http://localhost:3000/ai-assistant',
        'http://localhost:3000/settings',
      ],
      // Number of runs per URL for more accurate results
      numberOfRuns: 3,
      // Start server command (optional, if not already running)
      startServerCommand: 'pnpm dev',
      startServerReadyPattern: 'Server running',
      startServerReadyTimeout: 30000,
      // Chrome flags for consistent results
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu --headless',
        // Throttling settings for consistent results
        throttling: {
          cpuSlowdownMultiplier: 4,
          rttMs: 150,
          throughputKbps: 1638.4,
        },
        // Skip some audits that are not applicable
        skipAudits: [
          'uses-http2', // Not applicable for local testing
          'redirects-http', // Not applicable for local testing
        ],
      },
    },
    assert: {
      // Performance budgets
      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'interactive': ['warn', { maxNumericValue: 3800 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],
        
        // Performance score thresholds
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Resource size budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }], // 500KB
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }], // 100KB
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }], // 500KB
        'resource-summary:total:size': ['warn', { maxNumericValue: 2000000 }], // 2MB
        
        // Network requests budget
        'resource-summary:third-party:count': ['warn', { maxNumericValue: 10 }],
        
        // Accessibility requirements
        'color-contrast': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
        'image-alt': 'warn',
        'link-name': 'warn',
        'button-name': 'warn',
        
        // Best practices
        'errors-in-console': 'warn',
        'deprecations': 'warn',
        'uses-passive-event-listeners': 'warn',
        'no-document-write': 'error',
        'js-libraries': 'off', // Informational only
        
        // SEO
        'viewport': 'error',
        'crawlable-anchors': 'warn',
        'robots-txt': 'off', // Not applicable for SPA
      },
    },
    upload: {
      // Upload to temporary public storage (for CI)
      target: 'temporary-public-storage',
      // Or use LHCI server
      // target: 'lhci',
      // serverBaseUrl: process.env.LHCI_SERVER_URL,
      // token: process.env.LHCI_TOKEN,
    },
  },
};
