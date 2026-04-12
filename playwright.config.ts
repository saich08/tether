import { defineConfig } from '@playwright/test'
import { join } from 'path'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  use: {
    // Electron-specific: launch via CLI, not browser
    launchOptions: {
      executablePath: join(
        __dirname,
        'node_modules/.bin/electron' + (process.platform === 'win32' ? '.cmd' : '')
      ),
      args: [join(__dirname, 'out/main/index.js')]
    }
  },
  projects: [
    {
      name: 'electron',
      use: {}
    }
  ]
})
