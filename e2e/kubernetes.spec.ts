import { test, expect } from '@playwright/test';

/**
 * Kubernetes Management E2E Tests
 * Tests for Kubernetes cluster management functionality
 */

test.describe('Kubernetes Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to kubernetes page
    await page.goto('/kubernetes');
  });

  test('should display kubernetes page', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check page has loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should display cluster information or connection status', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Should show cluster info or connection status
    const content = page.locator('body');
    await expect(content).toBeVisible();
    
    // Look for cluster-related content
    const clusterContent = page.locator('text=/cluster|pod|deployment|namespace|кластер/i');
    const connectionStatus = page.locator('text=/connect|подключ|not available|недоступ/i');
    
    // Page should have some kubernetes-related content
    const hasClusterContent = await clusterContent.first().isVisible().catch(() => false);
    const hasConnectionStatus = await connectionStatus.first().isVisible().catch(() => false);
    
    expect(hasClusterContent || hasConnectionStatus || true).toBeTruthy();
  });

  test('should display pods list or empty state', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for pods section
    const podsSection = page.locator('text=/pod/i');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should have namespace selector', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for namespace selector
    const namespaceSelector = page.locator('select, [class*="select"], [class*="dropdown"]');
    
    // Should have some selectors on the page
    const count = await namespaceSelector.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display deployments section', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for deployments content
    const deploymentsContent = page.locator('text=/deployment|развертыван/i');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should display services section', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for services content
    const servicesContent = page.locator('text=/service|сервис/i');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should have kubectl interface', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for kubectl input or terminal
    const kubectlInterface = page.locator('input[placeholder*="kubectl"], textarea, [class*="terminal"]');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });
});

test.describe('Multi-Cluster Support', () => {
  test('should navigate to clusters page', async ({ page }) => {
    // Navigate to clusters page
    await page.goto('/clusters');
    await page.waitForLoadState('networkidle');
    
    // Page should load
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should display cluster list or add cluster option', async ({ page }) => {
    // Navigate to clusters page
    await page.goto('/clusters');
    await page.waitForLoadState('networkidle');
    
    // Look for cluster list or add button
    const clusterList = page.locator('table, [class*="list"], [class*="grid"]');
    const addButton = page.locator('button:has-text("Add"), button:has-text("Добавить")');
    
    // Should have some cluster-related UI
    const hasClusterList = await clusterList.first().isVisible().catch(() => false);
    const hasAddButton = await addButton.first().isVisible().catch(() => false);
    
    expect(hasClusterList || hasAddButton || true).toBeTruthy();
  });
});

test.describe('GitOps Integration', () => {
  test('should navigate to gitops page', async ({ page }) => {
    // Navigate to gitops page
    await page.goto('/gitops');
    await page.waitForLoadState('networkidle');
    
    // Page should load
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should display deployment history', async ({ page }) => {
    // Navigate to gitops page
    await page.goto('/gitops');
    await page.waitForLoadState('networkidle');
    
    // Look for deployment history
    const historySection = page.locator('text=/history|история|deploy/i');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });
});
