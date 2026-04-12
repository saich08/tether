import React, { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react'
import { Terminal as TerminalInstance } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  connectionId: string
}

export interface TerminalHandle {
  sendCommand: (cmd: string) => void
  fit: () => void
}

const TERMINAL_THEME = {
  background: '#0e1020',
  foreground: '#c8cfe8',
  cursor: '#818cf8',
  cursorAccent: '#0e1020',
  black: '#1a1d2e',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#c8cfe8',
  brightBlack: '#3d4470',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f0f2f8',
  selectionBackground: '#3d4470',
  selectionForeground: '#f0f2f8'
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal({ connectionId }, ref): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<TerminalInstance | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const shellOpenedRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useImperativeHandle(ref, () => ({
    sendCommand: (cmd: string) => {
      window.electron.terminal.sendData(connectionId, cmd)
    },
    fit: () => {
      requestAnimationFrame(() => fitAddonRef.current?.fit())
    }
  }), [connectionId])

  const openShell = useCallback(async (term: TerminalInstance, fitAddon: FitAddon) => {
    if (shellOpenedRef.current) return
    shellOpenedRef.current = true

    fitAddon.fit()
    const dims = { cols: term.cols, rows: term.rows }

    const result = await window.electron.terminal.openShell(connectionId, dims)
    if (!result.ok) {
      term.writeln(`\r\n\x1b[31mFailed to open shell: ${result.error}\x1b[0m`)
    }
  }, [connectionId])

  useEffect(() => {
    if (!containerRef.current) return

    const term = new TerminalInstance({
      theme: TERMINAL_THEME,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowTransparency: true,
      convertEol: true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.loadAddon(searchAddon)

    termRef.current = term
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    term.open(containerRef.current)
    term.writeln('\x1b[36m┌─────────────────────────────────────┐\x1b[0m')
    term.writeln('\x1b[36m│  Tether  —  Connecting...           │\x1b[0m')
    term.writeln('\x1b[36m└─────────────────────────────────────┘\x1b[0m')
    term.writeln('')

    // Input: send keystrokes to SSH shell
    const dataDispose = term.onData((data) => {
      window.electron.terminal.sendData(connectionId, data)
    })

    // Receive output from SSH shell
    const removeDataListener = window.electron.terminal.onData(({ connectionId: cid, data }) => {
      if (cid === connectionId) {
        term.write(data)
      }
    })

    // Resize
    const resizeDispose = term.onResize(({ cols, rows }) => {
      window.electron.terminal.resize(connectionId, { cols, rows })
    })

    openShell(term, fitAddon)

    // ResizeObserver for container size changes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit())
    })
    ro.observe(containerRef.current)

    cleanupRef.current = () => {
      dataDispose.dispose()
      resizeDispose.dispose()
      removeDataListener()
      ro.disconnect()
      term.dispose()
    }

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
      shellOpenedRef.current = false
    }
  }, [connectionId])

  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!searchAddonRef.current) return
      if (e.key === 'Enter') {
        searchAddonRef.current.findNext(searchQuery)
      } else if (e.key === 'Escape') {
        setSearchVisible(false)
        setSearchQuery('')
        termRef.current?.focus()
      }
    },
    [searchQuery]
  )

  return (
    <div className="flex flex-col h-full bg-surface-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 h-8 bg-surface-900 border-b border-surface-800 flex-shrink-0">
        <span className="text-xs text-surface-400 font-medium tracking-wide uppercase">Terminal</span>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost p-1 rounded"
            title="Search (Ctrl+F)"
            onClick={() => {
              setSearchVisible((v) => !v)
              if (!searchVisible) {
                setTimeout(() => {
                  document.getElementById('terminal-search-input')?.focus()
                }, 50)
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.44 1.406a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
            </svg>
          </button>
          <button
            className="btn-ghost p-1 rounded"
            title="Clear terminal"
            onClick={() => termRef.current?.clear()}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 1 0v7a.5.5 0 0 1-1 0V5zm3 0a.5.5 0 0 1 1 0v7a.5.5 0 0 1-1 0V5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchVisible && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-900 border-b border-surface-800 flex-shrink-0">
          <input
            id="terminal-search-input"
            type="text"
            className="input py-0.5 text-xs h-6 flex-1"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
          <button
            className="btn-ghost p-1 text-xs"
            onClick={() => searchAddonRef.current?.findNext(searchQuery)}
          >
            ↓
          </button>
          <button
            className="btn-ghost p-1 text-xs"
            onClick={() => searchAddonRef.current?.findPrevious(searchQuery)}
          >
            ↑
          </button>
        </div>
      )}

      {/* terminal container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ minHeight: 0 }}
        onClick={() => termRef.current?.focus()}
      />
    </div>
  )
})
