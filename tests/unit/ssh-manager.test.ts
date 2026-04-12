import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockStream = Object.assign(new EventEmitter(), {
  write: vi.fn(),
  stderr: new EventEmitter(),
  setWindow: vi.fn()
})

const mockSFTP = {
  readdir: vi.fn(),
  fastGet: vi.fn(),
  fastPut: vi.fn(),
  unlink: vi.fn(),
  rmdir: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn()
}

const mockClient = Object.assign(new EventEmitter(), {
  connect: vi.fn(),
  end: vi.fn(),
  shell: vi.fn(),
  sftp: vi.fn()
})

vi.mock('ssh2', () => ({
  Client: vi.fn(() => mockClient)
}))

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234')
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SSHManager', () => {
  let SSHManager: typeof import('../../src/main/ssh-manager').SSHManager
  let manager: InstanceType<typeof import('../../src/main/ssh-manager').SSHManager>

  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-import to get fresh instance with cleared mocks
    const mod = await import('../../src/main/ssh-manager')
    SSHManager = mod.SSHManager
    manager = new SSHManager()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('connect()', () => {
    it('resolves with a connection object when client emits ready', async () => {
      mockClient.connect.mockImplementation(() => {
        setImmediate(() => mockClient.emit('ready'))
      })

      const credentials = {
        host: '10.0.0.1',
        port: 22,
        username: 'admin',
        authMethod: 'password' as const,
        password: 'secret'
      }

      const connection = await manager.connect(credentials)

      expect(connection.id).toBe('test-uuid-1234')
      expect(connection.status).toBe('connected')
      expect(connection.credentials.host).toBe('10.0.0.1')
      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: '10.0.0.1',
          port: 22,
          username: 'admin',
          password: 'secret'
        })
      )
    })

    it('rejects when client emits error', async () => {
      mockClient.connect.mockImplementation(() => {
        setImmediate(() => mockClient.emit('error', new Error('Connection refused')))
      })

      await expect(
        manager.connect({
          host: '10.0.0.1',
          port: 22,
          username: 'admin',
          authMethod: 'password',
          password: 'bad'
        })
      ).rejects.toThrow('Connection refused')
    })

    it('uses privateKey auth when authMethod is privateKey', async () => {
      mockClient.connect.mockImplementation(() => {
        setImmediate(() => mockClient.emit('ready'))
      })

      await manager.connect({
        host: '10.0.0.1',
        port: 22,
        username: 'admin',
        authMethod: 'privateKey',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
      })

      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey: expect.stringContaining('RSA PRIVATE KEY')
        })
      )
      expect(mockClient.connect).not.toHaveBeenCalledWith(
        expect.objectContaining({ password: expect.anything() })
      )
    })
  })

  describe('disconnect()', () => {
    it('calls client.end() for an existing session', async () => {
      mockClient.connect.mockImplementation(() => {
        setImmediate(() => mockClient.emit('ready'))
      })

      const conn = await manager.connect({
        host: '10.0.0.1',
        port: 22,
        username: 'admin',
        authMethod: 'password',
        password: 'pw'
      })

      manager.disconnect(conn.id)
      expect(mockClient.end).toHaveBeenCalled()
    })

    it('does nothing for an unknown connectionId', () => {
      expect(() => manager.disconnect('unknown-id')).not.toThrow()
      expect(mockClient.end).not.toHaveBeenCalled()
    })
  })

  describe('getAllConnections()', () => {
    it('returns empty array initially', () => {
      expect(manager.getAllConnections()).toEqual([])
    })

    it('returns active connections after connect', async () => {
      mockClient.connect.mockImplementation(() => {
        setImmediate(() => mockClient.emit('ready'))
      })

      await manager.connect({
        host: '10.0.0.1',
        port: 22,
        username: 'admin',
        authMethod: 'password',
        password: 'pw'
      })

      expect(manager.getAllConnections()).toHaveLength(1)
    })
  })

  describe('listDirectory()', () => {
    it('returns sorted directory listing', async () => {
      mockClient.connect.mockImplementation(() => {
        setImmediate(() => mockClient.emit('ready'))
      })
      mockClient.sftp.mockImplementation((cb: (err: null, sftp: typeof mockSFTP) => void) => {
        cb(null, mockSFTP)
      })

      const rawEntries = [
        {
          filename: 'file.txt',
          attrs: { mode: 0o100644, size: 1024, mtime: 1700000000, uid: 0, gid: 0 }
        },
        {
          filename: 'adir',
          attrs: { mode: 0o040755, size: 4096, mtime: 1700000100, uid: 0, gid: 0 }
        },
        {
          filename: 'another.sh',
          attrs: { mode: 0o100755, size: 256, mtime: 1700000050, uid: 0, gid: 0 }
        }
      ]

      mockSFTP.readdir.mockImplementation(
        (_path: string, cb: (err: null, list: typeof rawEntries) => void) => {
          cb(null, rawEntries)
        }
      )

      const conn = await manager.connect({
        host: '10.0.0.1',
        port: 22,
        username: 'admin',
        authMethod: 'password',
        password: 'pw'
      })

      const listing = await manager.listDirectory(conn.id, '/home')

      expect(listing.path).toBe('/home')
      // Directories come first
      expect(listing.entries[0].name).toBe('adir')
      expect(listing.entries[0].isDirectory).toBe(true)
      // Files sorted alphabetically after
      expect(listing.entries[1].name).toBe('another.sh')
      expect(listing.entries[2].name).toBe('file.txt')
    })
  })
})
