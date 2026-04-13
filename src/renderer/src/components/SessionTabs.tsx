import type { SSHConnection } from "../../../shared/types";

interface SessionTabsProps {
  sessions: { id: string; connection: SSHConnection }[];
  activeSessionId: string | null;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewSession: () => void;
}

export function SessionTabs({
  sessions,
  activeSessionId,
  onSwitchTab,
  onCloseTab,
  onNewSession,
}: SessionTabsProps): JSX.Element {
  return (
    <div className="flex items-center h-9 bg-surface-950 border-b border-surface-800 flex-shrink-0 overflow-x-auto">
      {sessions.map(({ id, connection }) => {
        const isActive = id === activeSessionId;
        const label = connection.credentials.label
          ? connection.credentials.label
          : `${connection.credentials.username}@${connection.credentials.host}`;
        return (
          <button
            key={id}
            onClick={() => onSwitchTab(id)}
            title={`${connection.credentials.username}@${connection.credentials.host}:${connection.credentials.port}`}
            className={[
              "group flex items-center gap-1.5 px-3 h-full text-xs font-mono border-r border-surface-800 flex-shrink-0 max-w-48 transition-colors",
              isActive
                ? "bg-surface-800 text-surface-100 border-t-2 border-t-accent-400"
                : "text-surface-400 hover:text-surface-200 hover:bg-surface-900",
            ].join(" ")}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {/* Status dot */}
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isActive ? "bg-success animate-pulse" : "bg-surface-600"
              }`}
            />
            {/* Label */}
            <span className="truncate">{label}</span>
            {/* Close */}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(id);
              }}
              className="ml-auto pl-1 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:text-surface-100 transition-opacity"
              title="Close session"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
              </svg>
            </span>
          </button>
        );
      })}

      {/* New session button */}
      <button
        onClick={onNewSession}
        title="New session (Ctrl+N)"
        className="flex items-center justify-center w-8 h-full text-surface-500 hover:text-surface-200 hover:bg-surface-900 flex-shrink-0 transition-colors"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
        </svg>
      </button>
    </div>
  );
}
