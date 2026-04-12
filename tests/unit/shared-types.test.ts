import { describe, it, expect } from 'vitest'
import { IPC } from '../../src/shared/types'

describe('IPC channel constants', () => {
  it('has no duplicate values', () => {
    const values = Object.values(IPC)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('all values are non-empty strings', () => {
    for (const v of Object.values(IPC)) {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })

  it('SSH channels are present', () => {
    expect(IPC.SSH_CONNECT).toBe('ssh:connect')
    expect(IPC.SSH_DISCONNECT).toBe('ssh:disconnect')
    expect(IPC.SSH_STATUS).toBe('ssh:status')
  })

  it('terminal channels are present', () => {
    expect(IPC.TERMINAL_DATA_IN).toBeDefined()
    expect(IPC.TERMINAL_DATA_OUT).toBeDefined()
    expect(IPC.TERMINAL_RESIZE).toBeDefined()
  })

  it('SFTP channels are present', () => {
    expect(IPC.SFTP_LIST).toBeDefined()
    expect(IPC.SFTP_DOWNLOAD).toBeDefined()
    expect(IPC.SFTP_UPLOAD).toBeDefined()
    expect(IPC.SFTP_DELETE).toBeDefined()
    expect(IPC.SFTP_MKDIR).toBeDefined()
    expect(IPC.SFTP_RENAME).toBeDefined()
  })
})
