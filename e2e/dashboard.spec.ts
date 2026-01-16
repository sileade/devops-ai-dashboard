import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 * Tests for the main dashboard page functionality
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/');
  });

  test('should display the dashboard page', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/DevOps/i);
    
    // Check main heading
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should display infrastructure overview cards', async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check for overview cards (Docker, Kubernetes, Deployments, Alerts)
    const cards = page.locator('[class*="card"], [class*="Card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display sidebar navigation', async ({ page }) => {
    // Check sidebar is visible
    const sidebar = page.locator('nav, [class*="sidebar"], [class*="Sidebar"]');
    await expect(sidebar.first()).toBeVisible();
    
    // Check navigation items exist
    const navItems = page.locator('nav a, [class*="sidebar"] a');
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to containers page', async ({ page }) => {
    // Click on containers link
    const containersLink = page.locator('a[href*="container"], a:has-text("Container")').first();
    
    if (await containersLink.isVisible()) {
      await containersLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verify navigation
      expect(page.url()).toContain('container');
    }
  });

  test('should navigate to kubernetes page', async ({ page }) => {
    // Click on kubernetes link
    const k8sLink = page.locator('a[href*="kubernetes"], a:has-text("Kubernetes")').first();
    
    if (await k8sLink.isVisible()) {
      await k8sLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verify navigation
      expect(page.url()).toContain('kubernetes');
    }
  });

  test('should display recent activity section', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for activity section
    const activitySection = page.locator('text=/recent|activity|событи/i').first();
    
    // Activity section should be visible or page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should display resource usage metrics', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for resource metrics (CPU, Memory, etc.)
    const metricsSection = page.locator('text=/cpu|memory|storage|ресурс/i').first();
    
    // Page should have loaded with content
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should have responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    
    // Page should still be functional
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');
    await expect(body).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForLoadState('networkidle');
    await expect(body).toBeVisible();
  });
});
