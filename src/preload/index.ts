import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/types";
import type {
  SSHCredentials,
  IPCResult,
  SFTPListRequest,
  SFTPDownloadRequest,
  SFTPUploadRequest,
  SFTPDeleteRequest,
  SFTPMkdirRequest,
  SFTPRenameRequest,
  SFTPCopyRequest,
  SFTPReadFileRequest,
  SFTPWriteFileRequest,
  TerminalDimensions,
  SSHConnection,
  DirectoryListing,
  SSHConfigProfile,
  SSHConfigWriteRequest,
  SSHConfigDeleteRequest,
} from "../shared/types";

// ─── Electron API exposed to the renderer via context bridge ────────────────

const electronAPI = {
  // SSH
  ssh: {
    connect: (credentials: SSHCredentials): Promise<IPCResult<string>> =>
      ipcRenderer.invoke(IPC.SSH_CONNECT, credentials),

    disconnect: (connectionId: string): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SSH_DISCONNECT, connectionId),

    onStatus: (cb: (connection: SSHConnection) => void): (() => void) => {
      const handler = (_: unknown, connection: SSHConnection): void =>
        cb(connection);
      ipcRenderer.on(IPC.SSH_STATUS, handler);
      return () => ipcRenderer.removeListener(IPC.SSH_STATUS, handler);
    },
  },

  // Terminal
  terminal: {
    openShell: (
      connectionId: string,
      dimensions: TerminalDimensions,
    ): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.TERMINAL_DATA_IN, { connectionId, dimensions }),

    sendData: (connectionId: string, data: string): void =>
      ipcRenderer.send(IPC.TERMINAL_DATA_IN, { connectionId, data }),

    resize: (connectionId: string, dimensions: TerminalDimensions): void =>
      ipcRenderer.send(IPC.TERMINAL_RESIZE, { connectionId, dimensions }),

    onData: (
      cb: (payload: { connectionId: string; data: string }) => void,
    ): (() => void) => {
      const handler = (
        _: unknown,
        payload: { connectionId: string; data: string },
      ): void => cb(payload);
      ipcRenderer.on(IPC.TERMINAL_DATA_OUT, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA_OUT, handler);
    },
  },

  // SFTP
  sftp: {
    list: (req: SFTPListRequest): Promise<IPCResult<DirectoryListing>> =>
      ipcRenderer.invoke(IPC.SFTP_LIST, req),

    download: (req: SFTPDownloadRequest): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SFTP_DOWNLOAD, req),

    upload: (req: SFTPUploadRequest): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SFTP_UPLOAD, req),

    delete: (
      req: SFTPDeleteRequest & { isDirectory: boolean },
    ): Promise<IPCResult> => ipcRenderer.invoke(IPC.SFTP_DELETE, req),

    mkdir: (req: SFTPMkdirRequest): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SFTP_MKDIR, req),

    rename: (req: SFTPRenameRequest): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SFTP_RENAME, req),

    copy: (req: SFTPCopyRequest): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SFTP_COPY, req),

    readFile: (req: SFTPReadFileRequest): Promise<IPCResult<string>> =>
      ipcRenderer.invoke(IPC.SFTP_READ_FILE, req),

    writeFile: (req: SFTPWriteFileRequest): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SFTP_WRITE_FILE, req),
  },

  // Shell utilities
  shell: {
    openVSCode: (req: {
      connectionId: string;
      path: string;
    }): Promise<IPCResult> => ipcRenderer.invoke(IPC.SHELL_OPEN_VSCODE, req),
  },

  // SSH config file management
  sshConfig: {
    getPath: (): Promise<IPCResult<string>> =>
      ipcRenderer.invoke(IPC.SSH_CONFIG_GET_PATH),

    setPath: (configPath: string): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SSH_CONFIG_SET_PATH, configPath),

    read: (configPath: string): Promise<IPCResult<SSHConfigProfile[]>> =>
      ipcRenderer.invoke(IPC.SSH_CONFIG_READ, configPath),

    write: (req: SSHConfigWriteRequest): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SSH_CONFIG_WRITE, req),

    delete: (req: SSHConfigDeleteRequest): Promise<IPCResult> =>
      ipcRenderer.invoke(IPC.SSH_CONFIG_DELETE, req),
  },
};

contextBridge.exposeInMainWorld("electron", electronAPI);

// ─── Type declarations for the renderer ─────────────────────────────────────

export type ElectronAPI = typeof electronAPI;
