import { ipcMain, BrowserWindow, dialog } from "electron";
import { spawn } from "child_process";
import { SSHManager } from "./ssh-manager";
import {
  IPC,
  IPCResult,
  SSHCredentials,
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
} from "../shared/types";

export function registerIpcHandlers(
  manager: SSHManager,
  getWindow: () => BrowserWindow | null,
): void {
  // ─── SSH Connect ──────────────────────────────────────────────────────────

  ipcMain.handle(
    IPC.SSH_CONNECT,
    async (_event, credentials: SSHCredentials): Promise<IPCResult<string>> => {
      try {
        const connection = await manager.connect(credentials);
        return { ok: true, data: connection.id };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SSH_DISCONNECT,
    async (_event, connectionId: string): Promise<IPCResult> => {
      try {
        manager.disconnect(connectionId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  // ─── Terminal ─────────────────────────────────────────────────────────────

  ipcMain.handle(
    IPC.TERMINAL_DATA_IN,
    async (
      _event,
      payload: { connectionId: string; dimensions: TerminalDimensions },
    ): Promise<IPCResult> => {
      try {
        await manager.openShell(
          payload.connectionId,
          payload.dimensions,
          (data) => {
            const win = getWindow();
            if (win) {
              win.webContents.send(IPC.TERMINAL_DATA_OUT, {
                connectionId: payload.connectionId,
                data,
              });
            }
          },
        );
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.on(
    IPC.TERMINAL_DATA_IN,
    (_event, payload: { connectionId: string; data: string }) => {
      manager.writeToShell(payload.connectionId, payload.data);
    },
  );

  ipcMain.on(
    IPC.TERMINAL_RESIZE,
    (
      _event,
      payload: { connectionId: string; dimensions: TerminalDimensions },
    ) => {
      manager.resizeShell(payload.connectionId, payload.dimensions);
    },
  );

  // ─── SFTP ─────────────────────────────────────────────────────────────────

  ipcMain.handle(
    IPC.SFTP_LIST,
    async (_event, req: SFTPListRequest): Promise<IPCResult> => {
      try {
        const listing = await manager.listDirectory(req.connectionId, req.path);
        return { ok: true, data: listing };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SFTP_DOWNLOAD,
    async (_event, req: SFTPDownloadRequest): Promise<IPCResult> => {
      try {
        let localPath = req.localPath;
        if (!localPath) {
          const result = await dialog.showSaveDialog({
            defaultPath: req.remotePath.split("/").pop(),
          });
          if (result.canceled || !result.filePath)
            return { ok: false, error: "Cancelled" };
          localPath = result.filePath;
        }
        await manager.downloadFile(req.connectionId, req.remotePath, localPath);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SFTP_UPLOAD,
    async (_event, req: SFTPUploadRequest): Promise<IPCResult> => {
      try {
        let localPath = req.localPath;
        if (!localPath) {
          const result = await dialog.showOpenDialog({
            properties: ["openFile"],
          });
          if (result.canceled || result.filePaths.length === 0)
            return { ok: false, error: "Cancelled" };
          localPath = result.filePaths[0];
        }
        await manager.uploadFile(req.connectionId, localPath, req.remotePath);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SFTP_DELETE,
    async (
      _event,
      req: SFTPDeleteRequest & { isDirectory: boolean },
    ): Promise<IPCResult> => {
      try {
        await manager.deleteItem(req.connectionId, req.path, req.isDirectory);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SFTP_MKDIR,
    async (_event, req: SFTPMkdirRequest): Promise<IPCResult> => {
      try {
        await manager.createDirectory(req.connectionId, req.path);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SFTP_RENAME,
    async (_event, req: SFTPRenameRequest): Promise<IPCResult> => {
      try {
        await manager.rename(req.connectionId, req.oldPath, req.newPath);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SFTP_READ_FILE,
    async (_event, req: SFTPReadFileRequest): Promise<IPCResult<string>> => {
      try {
        const content = await manager.readFile(req.connectionId, req.path);
        return { ok: true, data: content };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SFTP_WRITE_FILE,
    async (_event, req: SFTPWriteFileRequest): Promise<IPCResult> => {
      try {
        await manager.writeFile(req.connectionId, req.path, req.content);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC.SFTP_COPY,
    async (_event, req: SFTPCopyRequest): Promise<IPCResult> => {
      try {
        await manager.copyItem(req.connectionId, req.sourcePath, req.destPath);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  // ─── Shell utilities ──────────────────────────────────────────────────────

  ipcMain.handle(
    IPC.SHELL_OPEN_VSCODE,
    (
      _event,
      { connectionId, path }: { connectionId: string; path: string },
    ): IPCResult => {
      const session = manager.getSession(connectionId);
      if (!session) return { ok: false, error: "No active session" };
      const { username, host, port } = session.connection.credentials;
      const authority =
        port === 22 ? `${username}@${host}` : `${username}@${host}:${port}`;
      const child = spawn(
        "code",
        ["--remote", `ssh-remote+${authority}`, path],
        {
          detached: true,
          stdio: "ignore",
        },
      );
      child.unref();
      return { ok: true };
    },
  );

  // ─── Forward status events to renderer ───────────────────────────────────

  manager.on("status", (connection) => {
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC.SSH_STATUS, connection);
    }
  });
}
