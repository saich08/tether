import React from "react";
import type { SSHConnection } from "../../../shared/types";

interface TitleBarProps {
  connection: SSHConnection | null;
  onNewConnection: () => void;
  onDisconnect: () => void;
  onSettings: () => void;
}

export function TitleBar({
  connection,
  onNewConnection,
  onDisconnect,
  onSettings,
}: TitleBarProps): JSX.Element {
  return (
    <div
      className="flex items-center justify-between pl-4 pr-36 h-10 bg-surface-950 border-b border-surface-800 select-none flex-shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
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
        <span className="text-sm font-semibold text-surface-200 tracking-wide">
          Tether
        </span>
      </div>

      {/* Center: connection status */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {connection ? (
          <>
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-surface-300 font-mono">
              {connection.credentials.username}@{connection.credentials.host}:
              {connection.credentials.port}
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
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
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
        <button
          onClick={onSettings}
          className="btn-ghost p-1.5 rounded"
          title="Settings"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
