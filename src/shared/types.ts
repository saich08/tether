// ─── SSH Connection ─────────────────────────────────────────────────────────

export interface SSHProxyConfig {
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "privateKey";
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SSHCredentials {
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "privateKey";
  password?: string;
  privateKey?: string;
  passphrase?: string;
  /** Optional display label */
  label?: string;
  /** Optional jump/proxy host */
  proxy?: SSHProxyConfig;
}

export interface SSHConnection {
  id: string;
  credentials: SSHCredentials;
  status: ConnectionStatus;
  connectedAt?: number;
}

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

// ─── SFTP / File System ──────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modifiedAt: number;
  permissions: string;
  owner: string;
  group: string;
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

// ─── Terminal ────────────────────────────────────────────────────────────────

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

// ─── IPC Channels ────────────────────────────────────────────────────────────

export const IPC = {
  // SSH lifecycle
  SSH_CONNECT: "ssh:connect",
  SSH_DISCONNECT: "ssh:disconnect",
  SSH_STATUS: "ssh:status",

  // Terminal I/O
  TERMINAL_DATA_IN: "terminal:data-in",
  TERMINAL_DATA_OUT: "terminal:data-out",
  TERMINAL_RESIZE: "terminal:resize",

  // SFTP operations
  SFTP_LIST: "sftp:list",
  SFTP_DOWNLOAD: "sftp:download",
  SFTP_UPLOAD: "sftp:upload",
  SFTP_DELETE: "sftp:delete",
  SFTP_MKDIR: "sftp:mkdir",
  SFTP_RENAME: "sftp:rename",
  SFTP_STAT: "sftp:stat",

  // Shell utilities
  SHELL_OPEN_VSCODE: "shell:open-vscode",
} as const;

export type IPCChannel = (typeof IPC)[keyof typeof IPC];

// ─── IPC Payloads ────────────────────────────────────────────────────────────

export interface IPCResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface SFTPListRequest {
  connectionId: string;
  path: string;
}

export interface SFTPDownloadRequest {
  connectionId: string;
  remotePath: string;
  localPath: string;
}

export interface SFTPUploadRequest {
  connectionId: string;
  localPath: string;
  remotePath: string;
}

export interface SFTPDeleteRequest {
  connectionId: string;
  path: string;
}

export interface SFTPMkdirRequest {
  connectionId: string;
  path: string;
}

export interface SFTPRenameRequest {
  connectionId: string;
  oldPath: string;
  newPath: string;
}
