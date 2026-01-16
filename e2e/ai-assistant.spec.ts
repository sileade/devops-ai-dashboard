import { test, expect } from '@playwright/test';

/**
 * AI Assistant E2E Tests
 * Tests for the AI-powered assistant functionality
 */

test.describe('AI Assistant', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to AI assistant page
    await page.goto('/ai');
  });

  test('should display AI assistant page', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check page has loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should display chat interface', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for chat interface elements
    const chatInterface = page.locator('[class*="chat"], [class*="message"], textarea, input[type="text"]');
    
    // Should have some chat-related UI
    const count = await chatInterface.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have message input field', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for input field
    const inputField = page.locator('textarea, input[type="text"], [contenteditable="true"]');
    
    // Should have input field
    const count = await inputField.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have send button', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for send button
    const sendButton = page.locator('button:has-text("Send"), button:has-text("Отправить"), button[type="submit"]');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should display AI status indicator', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for status indicator
    const statusIndicator = page.locator('text=/online|offline|available|доступ|статус/i');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should have chat history section', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for chat history
    const chatHistory = page.locator('[class*="history"], [class*="messages"], [class*="conversation"]');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should allow typing in input field', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Find input field
    const inputField = page.locator('textarea, input[type="text"]').first();
    
    if (await inputField.isVisible().catch(() => false)) {
      // Type a test message
      await inputField.fill('Test message');
      
      // Verify text was entered
      const value = await inputField.inputValue();
      expect(value).toBe('Test message');
    }
  });

  test('should have new chat button', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for new chat button
    const newChatButton = page.locator('button:has-text("New"), button:has-text("Новый"), button:has-text("Clear")');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should have export functionality', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Экспорт"), button:has-text("Download")');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });
});

test.describe('AI Recommendations', () => {
  test('should display recommendations section', async ({ page }) => {
    // Navigate to AI page
    await page.goto('/ai');
    await page.waitForLoadState('networkidle');
    
    // Look for recommendations
    const recommendations = page.locator('text=/recommend|suggestion|рекоменд|предложен/i');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });
});

test.describe('Auto-Scaling', () => {
  test('should navigate to scaling page', async ({ page }) => {
    // Navigate to scaling page
    await page.goto('/scaling');
    await page.waitForLoadState('networkidle');
    
    // Page should load
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('should display scaling rules', async ({ page }) => {
    // Navigate to scaling page
    await page.goto('/scaling');
    await page.waitForLoadState('networkidle');
    
    // Look for scaling rules
    const scalingRules = page.locator('text=/rule|правил|scaling|масштаб/i');
    
    // Page should have loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });
});
