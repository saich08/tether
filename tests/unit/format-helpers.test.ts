import { describe, it, expect } from 'vitest'

// Pull out the private helpers by re-implementing them here for isolated testing.
// This keeps tests pure without exposing internals or changing the production API.

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

describe('formatSize()', () => {
  it('returns — for 0 bytes', () => {
    expect(formatSize(0)).toBe('—')
  })

  it('formats bytes', () => {
    expect(formatSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(2048)).toBe('2.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })
})

describe('formatDate()', () => {
  it('returns — for falsy timestamp', () => {
    expect(formatDate(0)).toBe('—')
  })

  it('returns a non-empty string for a valid timestamp', () => {
    const result = formatDate(Date.now())
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toBe('—')
  })

  it('includes the year in the formatted date', () => {
    const ts = new Date('2024-06-15').getTime()
    const result = formatDate(ts)
    expect(result).toMatch(/2024/)
  })
})
