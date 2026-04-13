import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { FileEntry } from '../../../shared/types'

interface FileEditorDialogProps {
  connectionId: string
  file: FileEntry
  onClose: () => void
}

export function FileEditorDialog({ connectionId, file, onClose }: FileEditorDialogProps): JSX.Element {
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDirty = content !== savedContent

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    window.electron.sftp.readFile({ connectionId, path: file.path }).then((result) => {
      if (cancelled) return
      if (result.ok && result.data !== undefined) {
        setContent(result.data)
        setSavedContent(result.data)
      } else {
        setError(result.error ?? 'Failed to read file')
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [connectionId, file.path])

  useEffect(() => {
    if (!loading && !error) {
      textareaRef.current?.focus()
    }
  }, [loading, error])

  const handleSave = useCallback(async () => {
    if (saving || !isDirty) return
    setSaving(true)
    setSaveError(null)
    const result = await window.electron.sftp.writeFile({ connectionId, path: file.path, content })
    setSaving(false)
    if (result.ok) {
      setSavedContent(content)
    } else {
      setSaveError(result.error ?? 'Save failed')
    }
  }, [saving, isDirty, connectionId, file.path, content])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !isDirty) { onClose(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, handleSave, isDirty])

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const start = el.selectionStart
    const end = el.selectionEnd
    const newContent = content.substring(0, start) + '  ' + content.substring(end)
    setContent(newContent)
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2
    })
  }

  const lineCount = content.split('\n').length

  const handleClose = (): void => {
    if (isDirty && !confirm('You have unsaved changes. Close anyway?')) return
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl shadow-black/60 flex flex-col w-full max-w-4xl"
        style={{ height: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-accent-600/20 border border-accent-500/30 flex items-center justify-center flex-shrink-0">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="text-accent-400">
                <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-surface-100 font-mono truncate">{file.name}</span>
                {isDirty && (
                  <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" title="Unsaved changes" />
                )}
              </div>
              <p className="text-xs text-surface-500 font-mono truncate">{file.path}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="btn-primary text-xs px-3 py-1.5 min-w-[72px] justify-center"
              onClick={handleSave}
              disabled={saving || !isDirty || loading}
              title="Save (Ctrl+S)"
            >
              {saving ? (
                <>
                  <svg className="animate-spin" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                    <path d="M8 2 A6 6 0 0 1 14 8" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/>
                  </svg>
                  Save
                </>
              )}
            </button>
            <button className="btn-ghost p-1.5 rounded-lg" onClick={handleClose} title="Close">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Editor body */}
        <div className="flex-1 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-surface-500 text-xs">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                <path d="M8 2 A6 6 0 0 1 14 8" />
              </svg>
              Loading…
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30 max-w-sm">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="text-danger flex-shrink-0 mt-0.5">
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                </svg>
                <p className="text-xs text-danger/90">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && (
            <textarea
              ref={textareaRef}
              className="w-full h-full bg-surface-950 text-surface-200 font-mono text-xs leading-5 px-4 py-3 resize-none outline-none border-0 placeholder-surface-600"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleTab}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          )}
        </div>

        {/* Footer / status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-surface-800 bg-surface-950/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-xs text-danger/80">{saveError}</span>
            )}
            {!saveError && isDirty && (
              <span className="text-xs text-warning/70">Unsaved changes</span>
            )}
            {!saveError && !isDirty && !loading && (
              <span className="text-xs text-success/60">Saved</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-surface-600">
            {!loading && <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>}
            <span className="hidden sm:inline">Ctrl+S to save</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
