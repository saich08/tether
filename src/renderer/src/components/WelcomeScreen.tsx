import React from "react";

interface WelcomeScreenProps {
  onConnect: () => void;
}

export function WelcomeScreen({ onConnect }: WelcomeScreenProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 bg-surface-950">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent-600/20 border border-accent-500/30 flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            className="text-accent-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-surface-100 tracking-tight">
            Tether
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            A modern SSH client with terminal & file explorer
          </p>
        </div>
      </div>

      {/* Connect button */}
      <button
        onClick={onConnect}
        className="btn-primary px-6 py-2.5 text-sm font-medium rounded-lg shadow-lg shadow-accent-600/20 hover:shadow-accent-500/30 transition-shadow"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
        </svg>
        New Connection
      </button>

      {/* Keyboard hint */}
      <div className="flex flex-col items-center gap-2 text-xs text-surface-600">
        <p>Connect to a remote machine over SSH</p>
        <div className="flex items-center gap-3">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 font-mono text-surface-400">
            Ctrl+N
          </kbd>
          <span>New connection</span>
        </div>
      </div>
    </div>
  );
}
