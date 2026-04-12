/**
 * E2E tests for the Tether Electron app.
 *
 * These tests use Playwright's Electron integration to drive
 * the real built application. Run `npm run build` first.
 */
import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' }
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
})

// ─── Welcome screen ───────────────────────────────────────────────────────────

test('shows welcome screen on startup', async () => {
  await expect(page.locator('text=Tether')).toBeVisible()
  await expect(page.locator('text=New Connection')).toBeVisible()
  await expect(page.locator('text=Not connected')).toBeVisible()
})

test('title bar shows app name', async () => {
  const title = page.locator('.text-surface-200', { hasText: 'Tether' }).first()
  await expect(title).toBeVisible()
})

// ─── Connection dialog ────────────────────────────────────────────────────────

test('opens connection dialog on button click', async () => {
  await page.click('button:has-text("Connect")')
  await expect(page.locator('text=New SSH Connection')).toBeVisible()
})

test('connection dialog has host, port, username fields', async () => {
  // Dialog should already be open from previous test
  await expect(page.locator('input[placeholder="192.168.1.1"]')).toBeVisible()
  await expect(page.locator('input[type="number"]')).toBeVisible()
  await expect(page.locator('input[placeholder="root"]')).toBeVisible()
})

test('connection dialog shows password auth by default', async () => {
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('connection dialog switches to private key auth', async () => {
  await page.click('button:has-text("Private Key")')
  await expect(page.locator('textarea[placeholder*="PEM private key"]')).toBeVisible()
})

test('connection dialog shows error when host is empty', async () => {
  // Clear any existing input and try to connect with empty host
  const hostInput = page.locator('input[placeholder="192.168.1.1"]')
  await hostInput.fill('')
  await page.click('button:has-text("Connect"):last-child')
  await expect(page.locator('text=Host is required')).toBeVisible()
})

test('connection dialog closes on Escape', async () => {
  await page.keyboard.press('Escape')
  await expect(page.locator('text=New SSH Connection')).not.toBeVisible()
})

test('connection dialog closes on Cancel button', async () => {
  // Re-open
  await page.click('button:has-text("Connect")')
  await expect(page.locator('text=New SSH Connection')).toBeVisible()
  await page.click('button:has-text("Cancel")')
  await expect(page.locator('text=New SSH Connection')).not.toBeVisible()
})

// ─── Window properties ────────────────────────────────────────────────────────

test('window has minimum dimensions', async () => {
  const { width, height } = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }))
  expect(width).toBeGreaterThanOrEqual(800)
  expect(height).toBeGreaterThanOrEqual(500)
})

test('window title is Tether', async () => {
  const title = await app.evaluate(({ app: a }) => {
    const win = a.BrowserWindow.getAllWindows()[0]
    return win?.getTitle() ?? ''
  })
  expect(title).toContain('Tether')
})
