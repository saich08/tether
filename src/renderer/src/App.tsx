import { useState, useCallback, useRef, useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { ConnectionDialog } from './components/ConnectionDialog'
import { SplitPane } from './components/SplitPane'
import { Terminal } from './components/Terminal'
import type { TerminalHandle } from './components/Terminal'
import { FileExplorer } from './components/FileExplorer'
import { WelcomeScreen } from './components/WelcomeScreen'
import type { SSHConnection } from '../../shared/types'

export default function App(): JSX.Element {
  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [activeConnection, setActiveConnection] = useState<SSHConnection | null>(null)
  const [currentPath, setCurrentPath] = useState('/')
  const terminalRef = useRef<TerminalHandle>(null)

  const handleConnected = useCallback((connection: SSHConnection) => {
    setActiveConnection(connection)
    setShowConnectionDialog(false)
    setCurrentPath('/')
  }, [])

  const handleDisconnect = useCallback(async () => {
    if (!activeConnection) return
    await window.electron.ssh.disconnect(activeConnection.id)
    setActiveConnection(null)
    setCurrentPath('/')
  }, [activeConnection])

  const handleJumpToFolder = useCallback((path: string) => {
    const escaped = path.replace(/'/g, "'\\''")
    terminalRef.current?.sendCommand(`cd '${escaped}'\n`)
  }, [])

  const handleOpenInVSCode = useCallback((connectionId: string, path: string) => {
    window.electron.shell.openVSCode({ connectionId, path })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setShowConnectionDialog(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-full bg-surface-950">
      <TitleBar
        connection={activeConnection}
        onNewConnection={() => setShowConnectionDialog(true)}
        onDisconnect={handleDisconnect}
      />

      <div className="flex-1 overflow-hidden">
        {activeConnection ? (
          <SplitPane
            defaultLeftWidth={60}
            left={
              <FileExplorer
                connectionId={activeConnection.id}
                currentPath={currentPath}
                onPathChange={setCurrentPath}
                onJumpToFolder={handleJumpToFolder}
                onOpenInVSCode={handleOpenInVSCode}
              />
            }
            right={
              <Terminal
                ref={terminalRef}
                connectionId={activeConnection.id}
              />
            }
          />
        ) : (
          <WelcomeScreen onConnect={() => setShowConnectionDialog(true)} />
        )}
      </div>

      {showConnectionDialog && (
        <ConnectionDialog
          onConnected={handleConnected}
          onClose={() => setShowConnectionDialog(false)}
        />
      )}
    </div>
  )
}
