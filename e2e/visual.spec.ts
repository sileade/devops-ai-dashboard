import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * 
 * These tests capture screenshots of key pages and compare them against baseline images.
 * Run `npx playwright test --update-snapshots` to update baseline images.
 */

test.describe('Visual Regression - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('dashboard page matches snapshot', async ({ page }) => {
    // Wait for dynamic content to settle
    await page.waitForTimeout(1000);
    
    // Hide dynamic elements that change frequently
    await page.evaluate(() => {
      // Hide timestamps and live indicators
      document.querySelectorAll('[data-testid="timestamp"], .live-indicator, .refresh-time').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    
    await expect(page).toHaveScreenshot('dashboard-full.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('dashboard header matches snapshot', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toHaveScreenshot('dashboard-header.png');
  });

  test('dashboard sidebar matches snapshot', async ({ page }) => {
    const sidebar = page.locator('nav, [data-testid="sidebar"], .sidebar').first();
    if (await sidebar.isVisible()) {
      await expect(sidebar).toHaveScreenshot('dashboard-sidebar.png');
    }
  });

  test('dashboard cards match snapshot', async ({ page }) => {
    // Wait for cards to load
    await page.waitForSelector('.card, [data-testid="stat-card"]', { timeout: 10000 }).catch(() => {});
    
    const cardsSection = page.locator('.grid, [data-testid="stats-grid"]').first();
    if (await cardsSection.isVisible()) {
      await expect(cardsSection).toHaveScreenshot('dashboard-cards.png');
    }
  });
});

test.describe('Visual Regression - Containers Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/containers');
    await page.waitForLoadState('networkidle');
  });

  test('containers page matches snapshot', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('containers-full.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('containers table matches snapshot', async ({ page }) => {
    const table = page.locator('table, [data-testid="containers-table"]').first();
    if (await table.isVisible()) {
      await expect(table).toHaveScreenshot('containers-table.png');
    }
  });
});

test.describe('Visual Regression - Kubernetes Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kubernetes');
    await page.waitForLoadState('networkidle');
  });

  test('kubernetes page matches snapshot', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('kubernetes-full.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - AI Assistant Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai-assistant');
    await page.waitForLoadState('networkidle');
  });

  test('ai assistant page matches snapshot', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('ai-assistant-full.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('ai chat interface matches snapshot', async ({ page }) => {
    const chatInterface = page.locator('[data-testid="chat-interface"], .chat-container').first();
    if (await chatInterface.isVisible()) {
      await expect(chatInterface).toHaveScreenshot('ai-chat-interface.png');
    }
  });
});

test.describe('Visual Regression - Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('settings page matches snapshot', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('settings-full.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Dark/Light Theme', () => {
  test('dashboard in dark theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Ensure dark theme is active (default)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    });
    
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-dark-theme.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('dashboard in light theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Switch to light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
    
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-light-theme.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Component States', () => {
  test('button hover states', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const button = page.locator('button').first();
    if (await button.isVisible()) {
      await button.hover();
      await page.waitForTimeout(300);
      await expect(button).toHaveScreenshot('button-hover.png');
    }
  });

  test('input focus states', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const input = page.locator('input').first();
    if (await input.isVisible()) {
      await input.focus();
      await page.waitForTimeout(300);
      await expect(input).toHaveScreenshot('input-focus.png');
    }
  });
});
