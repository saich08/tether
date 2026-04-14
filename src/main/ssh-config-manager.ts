import { app } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { SSHConfigEntry, SSHConfigProfile } from "../shared/types";

// ─── Paths ────────────────────────────────────────────────────────────────────

const SETTINGS_FILE = path.join(
  app.getPath("userData"),
  "tether-settings.json",
);
const DEFAULT_SSH_DIR = path.join(os.homedir(), ".ssh");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_SSH_DIR, "config");

// ─── App settings (config path persistence) ──────────────────────────────────

function readSettings(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(settings: Record<string, string>): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}

export function getConfigPath(): string {
  return readSettings()["sshConfigPath"] ?? DEFAULT_CONFIG_PATH;
}

export function setConfigPath(p: string): void {
  const settings = readSettings();
  settings["sshConfigPath"] = p;
  writeSettings(settings);
}

// ─── SSH config parser ────────────────────────────────────────────────────────

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function collapseHome(p: string): string {
  const home = os.homedir();
  if (p.startsWith(home + path.sep) || p === home) {
    return "~/" + p.slice(home.length + 1);
  }
  return p;
}

interface RawBlock {
  alias: string;
  lines: string[]; // original indented lines for the block body
}

/** Split config content into raw blocks, preserving unrecognised sections. */
function parseBlocks(content: string): {
  preamble: string[];
  blocks: RawBlock[];
} {
  const lines = content.split("\n");
  const preamble: string[] = [];
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith("host ") || lower === "host") {
      if (current) blocks.push(current);
      const alias = trimmed.slice(5).trim();
      current = { alias, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) blocks.push(current);

  return { preamble, blocks };
}

function blockToEntry(block: RawBlock): SSHConfigEntry | null {
  // Skip wildcard host entries
  if (block.alias === "*" || block.alias.includes("*")) return null;

  const entry: Partial<SSHConfigEntry> & { host: string } = {
    host: block.alias,
    port: 22,
    hostname: "",
    user: "",
  };

  for (const line of block.lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const spaceIdx = trimmed.search(/\s/);
    if (spaceIdx === -1) continue;
    const keyword = trimmed.slice(0, spaceIdx).toLowerCase();
    const value = trimmed.slice(spaceIdx).trim();

    switch (keyword) {
      case "hostname":
        entry.hostname = value;
        break;
      case "port":
        entry.port = parseInt(value, 10) || 22;
        break;
      case "user":
        entry.user = value;
        break;
      case "identityfile":
        entry.identityFile = value;
        break;
    }
  }

  if (!entry.hostname) return null;
  return entry as SSHConfigEntry;
}

function entryToBlock(entry: SSHConfigEntry): string {
  const lines = [`Host ${entry.host}`];
  lines.push(`  HostName ${entry.hostname}`);
  lines.push(`  Port ${entry.port}`);
  if (entry.user) lines.push(`  User ${entry.user}`);
  if (entry.identityFile) lines.push(`  IdentityFile ${entry.identityFile}`);
  return lines.join("\n");
}

function blocksToContent(preamble: string[], blocks: RawBlock[]): string {
  const parts: string[] = [];
  if (preamble.length > 0) {
    parts.push(preamble.join("\n"));
  }
  for (const block of blocks) {
    parts.push(`Host ${block.alias}\n${block.lines.join("\n")}`);
  }
  return parts.join("\n\n").trimEnd() + "\n";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function readConfig(configPath: string): SSHConfigProfile[] {
  let content = "";
  try {
    content = fs.readFileSync(configPath, "utf8");
  } catch {
    return [];
  }

  const { blocks } = parseBlocks(content);
  const profiles: SSHConfigProfile[] = [];

  for (const block of blocks) {
    const entry = blockToEntry(block);
    if (!entry) continue;

    const profile: SSHConfigProfile = { ...entry };

    if (entry.identityFile) {
      const keyPath = expandHome(entry.identityFile);
      try {
        profile.privateKeyContent = fs.readFileSync(keyPath, "utf8");
      } catch {
        // key file not readable — leave privateKeyContent undefined
      }
    }

    profiles.push(profile);
  }

  return profiles;
}

export function writeEntry(
  configPath: string,
  entry: SSHConfigEntry,
  privateKeyContent?: string,
): void {
  // If a private key was provided, save it to ~/.ssh/tether_<alias>
  if (privateKeyContent?.trim()) {
    const sshDir = DEFAULT_SSH_DIR;
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
    }
    const sanitizedAlias = entry.host.replace(/[^a-zA-Z0-9._-]/g, "_");
    const keyFileName = `tether_${sanitizedAlias}`;
    const keyPath = path.join(sshDir, keyFileName);
    fs.writeFileSync(keyPath, privateKeyContent.trim() + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    entry = { ...entry, identityFile: collapseHome(keyPath) };
  }

  // Ensure config file and parent directory exist
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  let content = "";
  try {
    content = fs.readFileSync(configPath, "utf8");
  } catch {
    // new file
  }

  const { preamble, blocks } = parseBlocks(content);

  // Remove existing block with the same alias
  const filtered = blocks.filter((b) => b.alias !== entry.host);

  // Build new block lines from the entry
  const newBlockBody = entryToBlock(entry)
    .split("\n")
    .slice(1) // drop "Host <alias>" line — it's the header
    .join("\n");

  filtered.push({ alias: entry.host, lines: newBlockBody.split("\n") });

  fs.writeFileSync(configPath, blocksToContent(preamble, filtered), "utf8");
}

export function deleteEntry(configPath: string, hostAlias: string): void {
  let content = "";
  try {
    content = fs.readFileSync(configPath, "utf8");
  } catch {
    return;
  }

  const { preamble, blocks } = parseBlocks(content);
  const filtered = blocks.filter((b) => b.alias !== hostAlias);
  fs.writeFileSync(configPath, blocksToContent(preamble, filtered), "utf8");
}
