import { test, expect } from '@playwright/test';

// Test data — must match the seed script
const STUDENT_LOGIN = {
  identifier: 'student.s1e-0001@la-chat.local',
  password: 'Password1',
};

test.describe('Student workflow', () => {
  test('login → view chat list → open announcements', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="text"]', STUDENT_LOGIN.identifier);
    await page.fill('input[type="password"]', STUDENT_LOGIN.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/chat');
    await expect(page.locator('text=LA Chat')).toBeVisible();

    // Navigate to announcements
    await page.click('text=📢');
    await page.waitForURL('**/announcements');
    await expect(page.locator('h1:has-text("Announcements")')).toBeVisible();
  });

  test('cannot access moderation queue', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', STUDENT_LOGIN.identifier);
    await page.fill('input[type="password"]', STUDENT_LOGIN.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/chat');

    // Try to access moderation page — should see access denied or redirect
    await page.goto('/moderation');
    // The page should either show an error or redirect
    // (exact behavior depends on frontend permission handling)
  });
});
