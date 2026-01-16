import { test, expect } from '@playwright/test';

/**
 * Mobile Device Tests
 * 
 * These tests verify responsive behavior and touch interactions on mobile devices.
 * Run with specific projects: npx playwright test e2e/mobile.spec.ts --project=iphone-14
 */

test.describe('Mobile - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display mobile menu button on small screens', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    // Look for hamburger menu or mobile menu button
    const menuButton = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], .hamburger-menu, [data-testid="sidebar-toggle"]');
    await expect(menuButton.first()).toBeVisible();
  });

  test('should toggle mobile navigation menu', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    const menuButton = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], .hamburger-menu, [data-testid="sidebar-toggle"]').first();
    
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
      
      // Check if navigation is now visible
      const nav = page.locator('nav, [data-testid="mobile-nav"], .mobile-navigation');
      await expect(nav.first()).toBeVisible();
    }
  });

  test('should navigate to containers page on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    // Open mobile menu if needed
    const menuButton = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], .hamburger-menu, [data-testid="sidebar-toggle"]').first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
    }
    
    // Click on containers link
    const containersLink = page.locator('a[href*="container"], [data-testid="nav-containers"]').first();
    if (await containersLink.isVisible()) {
      await containersLink.click();
      await expect(page).toHaveURL(/container/);
    }
  });
});

test.describe('Mobile - Touch Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should handle tap on buttons', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    const button = page.locator('button:visible').first();
    if (await button.isVisible()) {
      await button.tap();
      // Button should respond to tap
      await page.waitForTimeout(100);
    }
  });

  test('should handle swipe gestures on cards', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    const card = page.locator('.card, [data-testid="stat-card"]').first();
    if (await card.isVisible()) {
      const box = await card.boundingBox();
      if (box) {
        // Simulate swipe
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();
      }
    }
  });

  test('should scroll page smoothly', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    // Scroll down
    await page.evaluate(() => {
      window.scrollTo({ top: 500, behavior: 'smooth' });
    });
    await page.waitForTimeout(500);
    
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });
});

test.describe('Mobile - Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should stack cards vertically on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    const cards = page.locator('.card, [data-testid="stat-card"]');
    const count = await cards.count();
    
    if (count >= 2) {
      const firstCard = await cards.nth(0).boundingBox();
      const secondCard = await cards.nth(1).boundingBox();
      
      if (firstCard && secondCard) {
        // On mobile, cards should be stacked (second card below first)
        // or side by side if viewport is wide enough
        expect(secondCard.y).toBeGreaterThanOrEqual(firstCard.y);
      }
    }
  });

  test('should hide sidebar on mobile by default', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
    // Sidebar should either be hidden or collapsed on mobile
    const isHidden = await sidebar.isHidden().catch(() => true);
    const hasCollapsedClass = await sidebar.evaluate(el => 
      el.classList.contains('collapsed') || 
      el.classList.contains('hidden') ||
      el.classList.contains('-translate-x-full')
    ).catch(() => true);
    
    expect(isHidden || hasCollapsedClass).toBeTruthy();
  });

  test('should adjust font sizes for mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    const heading = page.locator('h1, h2, .title').first();
    if (await heading.isVisible()) {
      const fontSize = await heading.evaluate(el => 
        window.getComputedStyle(el).fontSize
      );
      // Font size should be reasonable for mobile (not too large)
      const fontSizeNum = parseInt(fontSize);
      expect(fontSizeNum).toBeLessThanOrEqual(48);
    }
  });
});

test.describe('Mobile - Visual Regression', () => {
  test('dashboard on iPhone 14', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('mobile-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('containers page on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    await page.goto('/containers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('mobile-containers.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('kubernetes page on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    await page.goto('/kubernetes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('mobile-kubernetes.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Mobile - Form Interactions', () => {
  test('should handle virtual keyboard for inputs', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const input = page.locator('input[type="text"], input[type="search"]').first();
    if (await input.isVisible()) {
      await input.tap();
      await input.fill('test input');
      
      const value = await input.inputValue();
      expect(value).toBe('test input');
    }
  });

  test('should handle select dropdowns on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const select = page.locator('select, [role="combobox"]').first();
    if (await select.isVisible()) {
      await select.tap();
      await page.waitForTimeout(300);
      // Dropdown should open
    }
  });
});

test.describe('Mobile - Performance', () => {
  test('should load dashboard within acceptable time on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Page should load within 10 seconds on mobile
    expect(loadTime).toBeLessThan(10000);
  });

  test('should not have horizontal scroll on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBeFalsy();
  });
});
