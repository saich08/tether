import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { SSHCredentials, SSHConnection } from '../../../shared/types'

interface ConnectionDialogProps {
  onConnected: (connection: SSHConnection) => void
  onClose: () => void
}

interface SavedProfile {
  label: string
  credentials: SSHCredentials
}

const STORAGE_KEY = 'tether-profiles'

function loadProfiles(): SavedProfile[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveProfiles(profiles: SavedProfile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

const DEFAULT_FORM: SSHCredentials = {
  host: '',
  port: 22,
  username: '',
  authMethod: 'password',
  password: '',
  privateKey: '',
  passphrase: '',
  label: ''
}

export function ConnectionDialog({ onConnected, onClose }: ConnectionDialogProps): JSX.Element {
  const [form, setForm] = useState<SSHCredentials>(DEFAULT_FORM)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<SavedProfile[]>(loadProfiles)
  const [saveProfile, setSaveProfile] = useState(false)
  const hostInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Close on Escape
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    hostInputRef.current?.focus()
  }, [])

  const set = useCallback(<K extends keyof SSHCredentials>(key: K, value: SSHCredentials[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
  }, [])

  const loadProfile = (profile: SavedProfile): void => {
    setForm(profile.credentials)
    setError(null)
  }

  const deleteProfile = (idx: number): void => {
    const updated = profiles.filter((_, i) => i !== idx)
    setProfiles(updated)
    saveProfiles(updated)
  }

  const handleConnect = async (): Promise<void> => {
    if (!form.host.trim()) { setError('Host is required'); return }
    if (!form.username.trim()) { setError('Username is required'); return }
    if (form.authMethod === 'password' && !form.password) {
      setError('Password is required')
      return
    }
    if (form.authMethod === 'privateKey' && !form.privateKey?.trim()) {
      setError('Private key is required')
      return
    }

    setConnecting(true)
    setError(null)

    // Optionally persist profile
    if (saveProfile && form.label?.trim()) {
      const updated = [
        ...profiles.filter((p) => p.label !== form.label),
        { label: form.label, credentials: { ...form } }
      ]
      setProfiles(updated)
      saveProfiles(updated)
    }

    const result = await window.electron.ssh.connect(form)

    setConnecting(false)

    if (result.ok && result.data) {
      onConnected({
        id: result.data,
        credentials: form,
        status: 'connected',
        connectedAt: Date.now()
      })
    } else {
      setError(result.error ?? 'Connection failed')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !connecting) handleConnect()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl shadow-black/60 w-full max-w-md mx-4 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-600/20 border border-accent-500/30 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-accent-400">
                <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm5.904-2.803a.5.5 0 1 0-.707.707L6.586 7.293l-1.39 1.39a.5.5 0 0 0 .707.707l1.39-1.39 1.39 1.39a.5.5 0 0 0 .707-.707L8 7.293l1.39-1.39a.5.5 0 0 0-.707-.707L7.293 6.586l-1.39-1.389z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-100">New SSH Connection</h2>
              <p className="text-xs text-surface-500">Connect to a remote machine</p>
            </div>
          </div>
          <button
            className="btn-ghost p-1.5 rounded-lg"
            onClick={onClose}
            title="Close"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        </div>

        <div className="flex gap-0 h-[420px]">
          {/* Saved profiles sidebar */}
          {profiles.length > 0 && (
            <div className="w-36 border-r border-surface-800 overflow-y-auto flex-shrink-0">
              <div className="px-3 py-2 text-xs text-surface-500 font-medium uppercase tracking-wide">
                Saved
              </div>
              {profiles.map((p, i) => (
                <div
                  key={i}
                  className="group flex items-center justify-between px-3 py-2 hover:bg-surface-800/60 cursor-pointer transition-colors"
                  onClick={() => loadProfile(p)}
                >
                  <span className="text-xs text-surface-300 truncate font-mono">{p.label || p.credentials.host}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-danger transition-all text-surface-600"
                    onClick={(e) => { e.stopPropagation(); deleteProfile(i) }}
                    title="Delete profile"
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
            {/* Host + Port */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-surface-400 mb-1 font-medium">Host</label>
                <input
                  ref={hostInputRef}
                  className="input"
                  placeholder="192.168.1.1"
                  value={form.host}
                  onChange={(e) => set('host', e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="w-20">
                <label className="block text-xs text-surface-400 mb-1 font-medium">Port</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => set('port', parseInt(e.target.value, 10) || 22)}
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs text-surface-400 mb-1 font-medium">Username</label>
              <input
                className="input"
                placeholder="root"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Auth method tabs */}
            <div>
              <label className="block text-xs text-surface-400 mb-2 font-medium">Authentication</label>
              <div className="flex gap-1 p-1 bg-surface-950 rounded-lg mb-3">
                <button
                  className={form.authMethod === 'password' ? 'tab-active flex-1' : 'tab-inactive flex-1'}
                  onClick={() => set('authMethod', 'password')}
                >
                  Password
                </button>
                <button
                  className={form.authMethod === 'privateKey' ? 'tab-active flex-1' : 'tab-inactive flex-1'}
                  onClick={() => set('authMethod', 'privateKey')}
                >
                  Private Key
                </button>
              </div>

              {form.authMethod === 'password' ? (
                <input
                  className="input"
                  type="password"
                  placeholder="Password"
                  value={form.password ?? ''}
                  onChange={(e) => set('password', e.target.value)}
                />
              ) : (
                <div className="space-y-2">
                  <textarea
                    className="input font-mono text-xs resize-none h-24"
                    placeholder="Paste your PEM private key here..."
                    value={form.privateKey ?? ''}
                    onChange={(e) => set('privateKey', e.target.value)}
                    spellCheck={false}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Passphrase (optional)"
                    value={form.passphrase ?? ''}
                    onChange={(e) => set('passphrase', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Save profile */}
            <div className="flex items-center gap-2">
              <input
                id="save-profile"
                type="checkbox"
                className="w-3.5 h-3.5 accent-accent-500 rounded"
                checked={saveProfile}
                onChange={(e) => setSaveProfile(e.target.checked)}
              />
              <label htmlFor="save-profile" className="text-xs text-surface-400 cursor-pointer">
                Save as profile
              </label>
              {saveProfile && (
                <input
                  className="input ml-2 h-6 py-0 text-xs flex-1"
                  placeholder="Profile name"
                  value={form.label ?? ''}
                  onChange={(e) => set('label', e.target.value)}
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-danger/10 border border-danger/30">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="text-danger flex-shrink-0 mt-0.5">
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                </svg>
                <p className="text-xs text-danger/90">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-surface-800 bg-surface-950/50">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary min-w-[100px] justify-center"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <>
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                  <path d="M8 2 A6 6 0 0 1 14 8" />
                </svg>
                Connecting…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm5.904-2.803a.5.5 0 1 0-.707.707L6.586 7.293l-1.39 1.39a.5.5 0 0 0 .707.707l1.39-1.39 1.39 1.39a.5.5 0 0 0 .707-.707L8 7.293l1.39-1.39a.5.5 0 0 0-.707-.707L7.293 6.586l-1.39-1.389z" />
                </svg>
                Connect
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
