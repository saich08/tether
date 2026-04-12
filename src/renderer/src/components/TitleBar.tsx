import React from 'react'
import type { SSHConnection } from '../../../shared/types'

interface TitleBarProps {
  connection: SSHConnection | null
  onNewConnection: () => void
  onDisconnect: () => void
}

export function TitleBar({ connection, onNewConnection, onDisconnect }: TitleBarProps): JSX.Element {
  return (
    <div
      className="flex items-center justify-between pl-4 pr-36 h-10 bg-surface-950 border-b border-surface-800 select-none flex-shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: app branding */}
      <div className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          className="text-accent-400 flex-shrink-0"
          fill="currentColor"
        >
          <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zm2.354 3.146a.5.5 0 0 0-.708.708L4.293 8l-1.647 1.646a.5.5 0 0 0 .708.708l2-2a.5.5 0 0 0 0-.708l-2-2zm3.146 4.354a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3z" />
        </svg>
        <span className="text-sm font-semibold text-surface-200 tracking-wide">Tether</span>
      </div>

      {/* Center: connection status */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {connection ? (
          <>
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-surface-300 font-mono">
              {connection.credentials.username}@{connection.credentials.host}:{connection.credentials.port}
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-surface-600" />
            <span className="text-xs text-surface-500">Not connected</span>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={onNewConnection}
          className="btn-ghost text-xs px-2 py-1 rounded"
          title="New Connection"
        >
          Connect
        </button>
        {connection && (
          <button
            onClick={onDisconnect}
            className="btn-danger text-xs px-2 py-1 rounded"
            title="Disconnect current session"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5z" />
              <path
                fillRule="evenodd"
                d="M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0zM1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8z"
              />
            </svg>
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}
