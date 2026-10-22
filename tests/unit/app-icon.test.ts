import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  BrowserWindow: vi.fn(() => ({
    on: vi.fn(),
    webContents: { setWindowOpenHandler: vi.fn() },
    loadFile: vi.fn()
  })),
  setAppUserModelId: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    on: vi.fn()
  },
  BrowserWindow: mocks.BrowserWindow,
  shell: { openExternal: vi.fn() },
  Menu: { setApplicationMenu: vi.fn() },
  nativeTheme: {}
}))

vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: mocks.setAppUserModelId },
  optimizer: { watchWindowShortcuts: vi.fn() },
  is: { dev: false }
}))

vi.mock('../../src/main/ssh-manager', () => ({
  SSHManager: vi.fn()
}))

vi.mock('../../src/main/ipc-handlers', () => ({
  registerIpcHandlers: vi.fn()
}))

vi.mock('../../resources/tether.png?asset', () => ({
  default: 'bundled-assets/tether.png'
}))

describe('application icon', () => {
  it('uses the bundled icon and the packaged Windows app identity', async () => {
    await import('../../src/main/index')

    expect(mocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'bundled-assets/tether.png' })
    )
    expect(mocks.setAppUserModelId).toHaveBeenCalledWith('com.saich08.tether')
  })
})
