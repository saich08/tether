import { useState, useCallback, useRef, useEffect, createRef } from "react";
import { TitleBar } from "./components/TitleBar";
import { SessionTabs } from "./components/SessionTabs";
import { ConnectionDialog } from "./components/ConnectionDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { SplitPane } from "./components/SplitPane";
import { Terminal } from "./components/Terminal";
import type { TerminalHandle } from "./components/Terminal";
import { FileExplorer } from "./components/FileExplorer";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ThemeProvider } from "./context/ThemeContext";
import type { SSHConnection } from "../../shared/types";

interface SessionData {
  connection: SSHConnection;
  currentPath: string;
}

export default function App(): JSX.Element {
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; data: SessionData }[]>(
    [],
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // Stable map of terminal refs keyed by connection id
  const terminalRefs = useRef<Map<string, React.RefObject<TerminalHandle>>>(
    new Map(),
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const handleConnected = useCallback((connection: SSHConnection) => {
    // Create a stable ref for this session's terminal
    if (!terminalRefs.current.has(connection.id)) {
      terminalRefs.current.set(connection.id, createRef<TerminalHandle>());
    }
    setSessions((prev) => [
      ...prev,
      { id: connection.id, data: { connection, currentPath: "/" } },
    ]);
    setActiveSessionId(connection.id);
    setShowConnectionDialog(false);
  }, []);

  const handleCloseTab = useCallback(async (id: string) => {
    await window.electron.ssh.disconnect(id);
    terminalRefs.current.delete(id);

    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      // Pick adjacent tab when closing the active one
      setActiveSessionId((cur) => {
        if (cur !== id) return cur;
        const idx = prev.findIndex((s) => s.id === id);
        return next[idx]?.id ?? next[idx - 1]?.id ?? null;
      });
      return next;
    });
  }, []);

  const handleSwitchTab = useCallback((id: string) => {
    setActiveSessionId(id);
    // Re-fit the terminal after it becomes visible
    requestAnimationFrame(() => {
      terminalRefs.current.get(id)?.current?.fit();
    });
  }, []);

  const handlePathChange = useCallback((id: string, path: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, data: { ...s.data, currentPath: path } } : s,
      ),
    );
  }, []);

  const handleJumpToFolder = useCallback((id: string, path: string) => {
    const escaped = path.replace(/'/g, "'\\''");
    terminalRefs.current.get(id)?.current?.sendCommand(`cd '${escaped}'\n`);
  }, []);

  const handleOpenInVSCode = useCallback(
    (connectionId: string, path: string) => {
      window.electron.shell.openVSCode({ connectionId, path });
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setShowConnectionDialog(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ThemeProvider>
      <div className="flex flex-col h-full bg-surface-950">
        <TitleBar
          connection={activeSession?.data.connection ?? null}
          onNewConnection={() => setShowConnectionDialog(true)}
          onDisconnect={() =>
            activeSessionId && handleCloseTab(activeSessionId)
          }
          onSettings={() => setShowSettings(true)}
        />

        {sessions.length > 0 && (
          <SessionTabs
            sessions={sessions.map((s) => ({
              id: s.id,
              connection: s.data.connection,
            }))}
            activeSessionId={activeSessionId}
            onSwitchTab={handleSwitchTab}
            onCloseTab={handleCloseTab}
            onNewSession={() => setShowConnectionDialog(true)}
          />
        )}

        <div className="flex-1 overflow-hidden relative">
          {sessions.length === 0 ? (
            <WelcomeScreen onConnect={() => setShowConnectionDialog(true)} />
          ) : (
            sessions.map(({ id, data }) => (
              <div
                key={id}
                className="absolute inset-0 flex flex-col"
                style={{ display: id === activeSessionId ? "flex" : "none" }}
              >
                <SplitPane
                  defaultLeftWidth={60}
                  left={
                    <FileExplorer
                      connectionId={id}
                      currentPath={data.currentPath}
                      onPathChange={(path) => handlePathChange(id, path)}
                      onJumpToFolder={(path) => handleJumpToFolder(id, path)}
                      onOpenInVSCode={handleOpenInVSCode}
                    />
                  }
                  right={
                    <Terminal
                      ref={terminalRefs.current.get(id)}
                      connectionId={id}
                    />
                  }
                />
              </div>
            ))
          )}
        </div>

        {showConnectionDialog && (
          <ConnectionDialog
            onConnected={handleConnected}
            onClose={() => setShowConnectionDialog(false)}
          />
        )}

        {showSettings && (
          <SettingsDialog onClose={() => setShowSettings(false)} />
        )}
      </div>
    </ThemeProvider>
  );
}
