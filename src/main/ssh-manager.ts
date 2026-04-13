import { Client, SFTPWrapper } from "ssh2";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { Readable } from "stream";
import type {
  SSHCredentials,
  SSHConnection,
  SSHProxyConfig,
  FileEntry,
  DirectoryListing,
  TerminalDimensions,
} from "../shared/types";

interface ShellStream extends NodeJS.ReadableStream, NodeJS.WritableStream {
  setWindow(rows: number, cols: number, height: number, width: number): void;
}

interface ActiveSession {
  connection: SSHConnection;
  client: Client;
  sftp?: SFTPWrapper;
  shell?: ShellStream;
}

export class SSHManager extends EventEmitter {
  private sessions = new Map<string, ActiveSession>();

  // ─── Connect ──────────────────────────────────────────────────────────────

  async connect(credentials: SSHCredentials): Promise<SSHConnection> {
    const id = randomUUID();
    const client = new Client();

    const connection: SSHConnection = {
      id,
      credentials,
      status: "connecting",
    };

    this.sessions.set(id, { connection, client });
    this.emitStatus(connection);

    try {
      const sock = credentials.proxy
        ? await this.openProxyTunnel(
            credentials.proxy,
            credentials.host,
            credentials.port,
          )
        : undefined;

      await new Promise<void>((resolve, reject) => {
        client.on("ready", () => {
          connection.status = "connected";
          connection.connectedAt = Date.now();
          this.emitStatus(connection);
          resolve();
        });

        client.on("error", (err) => {
          connection.status = "error";
          this.emitStatus(connection);
          this.sessions.delete(id);
          reject(new Error(err.message));
        });

        client.on("close", () => {
          const session = this.sessions.get(id);
          if (session) {
            session.connection.status = "disconnected";
            this.emitStatus(session.connection);
            this.sessions.delete(id);
          }
        });

        const connectConfig: Parameters<Client["connect"]>[0] = {
          host: credentials.host,
          port: credentials.port,
          username: credentials.username,
          readyTimeout: 15000,
          keepaliveInterval: 30000,
          sock: sock ?? undefined,
        };

        if (credentials.authMethod === "password") {
          connectConfig.password = credentials.password;
        } else {
          connectConfig.privateKey = credentials.privateKey;
          if (credentials.passphrase) {
            connectConfig.passphrase = credentials.passphrase;
          }
        }

        client.connect(connectConfig);
      });
    } catch (err) {
      connection.status = "error";
      this.emitStatus(connection);
      this.sessions.delete(id);
      throw err;
    }

    return connection;
  }

  private openProxyTunnel(
    proxy: SSHProxyConfig,
    targetHost: string,
    targetPort: number,
  ): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const proxyClient = new Client();

      proxyClient.on("ready", () => {
        proxyClient.forwardOut(
          "127.0.0.1",
          0,
          targetHost,
          targetPort,
          (err, stream) => {
            if (err) {
              proxyClient.end();
              return reject(new Error(`Proxy tunnel failed: ${err.message}`));
            }
            stream.on("close", () => proxyClient.end());
            resolve(stream as unknown as Readable);
          },
        );
      });

      proxyClient.on("error", (err) => {
        reject(new Error(`Proxy connection failed: ${err.message}`));
      });

      const proxyCfg: Parameters<Client["connect"]>[0] = {
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        readyTimeout: 15000,
      };

      if (proxy.authMethod === "password") {
        proxyCfg.password = proxy.password;
      } else {
        proxyCfg.privateKey = proxy.privateKey;
        if (proxy.passphrase) proxyCfg.passphrase = proxy.passphrase;
      }

      proxyClient.connect(proxyCfg);
    });
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  disconnect(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (!session) return;
    session.client.end();
    this.sessions.delete(connectionId);
  }

  // ─── Shell / Terminal ─────────────────────────────────────────────────────

  async openShell(
    connectionId: string,
    dimensions: TerminalDimensions,
    onData: (data: string) => void,
  ): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session) throw new Error(`No session for ${connectionId}`);

    await new Promise<void>((resolve, reject) => {
      session.client.shell(
        {
          term: "xterm-256color",
          cols: dimensions.cols,
          rows: dimensions.rows,
        },
        (err, stream) => {
          if (err) return reject(err);

          session.shell = stream as unknown as ShellStream;

          stream.on("data", (chunk: Buffer) => {
            onData(chunk.toString("utf8"));
          });

          stream.stderr.on("data", (chunk: Buffer) => {
            onData(chunk.toString("utf8"));
          });

          stream.on("close", () => {
            session.shell = undefined;
          });

          resolve();
        },
      );
    });
  }

  writeToShell(connectionId: string, data: string): void {
    const session = this.sessions.get(connectionId);
    if (!session?.shell) return;
    session.shell.write(data);
  }

  resizeShell(connectionId: string, dimensions: TerminalDimensions): void {
    const session = this.sessions.get(connectionId);
    if (!session?.shell) return;
    session.shell.setWindow(dimensions.rows, dimensions.cols, 0, 0);
  }

  // ─── SFTP ─────────────────────────────────────────────────────────────────

  private async getSFTP(connectionId: string): Promise<SFTPWrapper> {
    const session = this.sessions.get(connectionId);
    if (!session) throw new Error(`No session for ${connectionId}`);

    if (session.sftp) return session.sftp;

    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      session.client.sftp((err, sftp) => {
        if (err) return reject(err);
        resolve(sftp);
      });
    });

    session.sftp = sftp;
    return sftp;
  }

  async listDirectory(
    connectionId: string,
    path: string,
  ): Promise<DirectoryListing> {
    const sftp = await this.getSFTP(connectionId);

    const entries = await new Promise<FileEntry[]>((resolve, reject) => {
      sftp.readdir(path, (err, list) => {
        if (err) return reject(err);

        const items: FileEntry[] = list.map((item) => {
          const mode = item.attrs.mode ?? 0;
          return {
            name: item.filename,
            path: `${path === "/" ? "" : path}/${item.filename}`,
            isDirectory: !!(mode & 0o040000),
            isSymlink: !!(mode & 0o120000),
            size: item.attrs.size ?? 0,
            modifiedAt: (item.attrs.mtime ?? 0) * 1000,
            permissions: this.formatPermissions(mode),
            owner: String(item.attrs.uid ?? 0),
            group: String(item.attrs.gid ?? 0),
          };
        });

        // Directories first, then alphabetical
        items.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        resolve(items);
      });
    });

    return { path, entries };
  }

  async downloadFile(
    connectionId: string,
    remotePath: string,
    localPath: string,
  ): Promise<void> {
    const sftp = await this.getSFTP(connectionId);
    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) =>
        err ? reject(err) : resolve(),
      );
    });
  }

  async uploadFile(
    connectionId: string,
    localPath: string,
    remotePath: string,
  ): Promise<void> {
    const sftp = await this.getSFTP(connectionId);
    await new Promise<void>((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) =>
        err ? reject(err) : resolve(),
      );
    });
  }

  async deleteItem(
    connectionId: string,
    path: string,
    isDirectory: boolean,
  ): Promise<void> {
    const sftp = await this.getSFTP(connectionId);
    if (isDirectory) {
      await new Promise<void>((resolve, reject) => {
        sftp.rmdir(path, (err) => (err ? reject(err) : resolve()));
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        sftp.unlink(path, (err) => (err ? reject(err) : resolve()));
      });
    }
  }

  async createDirectory(connectionId: string, path: string): Promise<void> {
    const sftp = await this.getSFTP(connectionId);
    await new Promise<void>((resolve, reject) => {
      sftp.mkdir(path, (err) => (err ? reject(err) : resolve()));
    });
  }

  async rename(
    connectionId: string,
    oldPath: string,
    newPath: string,
  ): Promise<void> {
    const sftp = await this.getSFTP(connectionId);
    await new Promise<void>((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => (err ? reject(err) : resolve()));
    });
  }

  async copyItem(
    connectionId: string,
    sourcePath: string,
    destPath: string,
  ): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session) throw new Error(`No session for ${connectionId}`);

    await new Promise<void>((resolve, reject) => {
      const esc = (p: string): string => `'${p.replace(/'/g, "'\\''")}'`;
      session.client.exec(
        `cp -r ${esc(sourcePath)} ${esc(destPath)}`,
        (err, stream) => {
          if (err) return reject(err);
          let stderr = "";
          stream.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
          stream.on("close", (code: number) => {
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || `cp exited with code ${code}`));
          });
        },
      );
    });
  }

  async readFile(connectionId: string, path: string): Promise<string> {
    const sftp = await this.getSFTP(connectionId);
    return new Promise<string>((resolve, reject) => {
      sftp.readFile(path, { encoding: "utf8" }, (err, data) => {
        if (err) return reject(err);
        resolve(data as unknown as string);
      });
    });
  }

  async writeFile(
    connectionId: string,
    path: string,
    content: string,
  ): Promise<void> {
    const sftp = await this.getSFTP(connectionId);
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile(path, content, (err) => (err ? reject(err) : resolve()));
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getSession(connectionId: string): ActiveSession | undefined {
    return this.sessions.get(connectionId);
  }

  getAllConnections(): SSHConnection[] {
    return Array.from(this.sessions.values()).map((s) => s.connection);
  }

  private emitStatus(connection: SSHConnection): void {
    this.emit("status", connection);
  }

  private formatPermissions(mode: number): string {
    const chars = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    return (
      (mode & 0o040000 ? "d" : mode & 0o120000 ? "l" : "-") +
      chars[(mode >> 6) & 7] +
      chars[(mode >> 3) & 7] +
      chars[mode & 7]
    );
  }
}
