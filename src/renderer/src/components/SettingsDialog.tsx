import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../context/ThemeContext";
import type { SSHConfigEntry, SSHConfigProfile } from "../../../shared/types";

interface SettingsDialogProps {
  onClose: () => void;
}

interface ThemeOption {
  id: Theme;
  name: string;
  bg: string;
  panel: string;
  accent: string;
  text: string;
}

const THEMES: ThemeOption[] = [
  {
    id: "default",
    name: "Default",
    bg: "#090b15",
    panel: "#1a1d2e",
    accent: "#6366f1",
    text: "#c8cfe8",
  },
  {
    id: "dark",
    name: "Dark",
    bg: "#0a0a0a",
    panel: "#1c1c1c",
    accent: "#3b82f6",
    text: "#b4b4b4",
  },
  {
    id: "light",
    name: "Light",
    bg: "#ffffff",
    panel: "#f1f5f9",
    accent: "#4f46e5",
    text: "#475569",
  },
  {
    id: "grass",
    name: "Grass",
    bg: "#030a05",
    panel: "#0e3c20",
    accent: "#22c55e",
    text: "#86efac",
  },
  {
    id: "techno",
    name: "Techno",
    bg: "#02060e",
    panel: "#0a3241",
    accent: "#06b6d4",
    text: "#67e8f9",
  },
];

const BLANK_ENTRY: SSHConfigEntry = {
  host: "",
  hostname: "",
  port: 22,
  user: "",
  identityFile: undefined,
};

type EntryFormState = SSHConfigEntry & { privateKeyContent: string };

function blankForm(): EntryFormState {
  return { ...BLANK_ENTRY, privateKeyContent: "" };
}

function profileToForm(p: SSHConfigProfile): EntryFormState {
  return {
    host: p.host,
    hostname: p.hostname,
    port: p.port,
    user: p.user,
    identityFile: p.identityFile,
    privateKeyContent: p.privateKeyContent ?? "",
  };
}

export function SettingsDialog({ onClose }: SettingsDialogProps): JSX.Element {
  const { theme, setTheme } = useTheme();

  // ─── SSH Config state ──────────────────────────────────────────────────────
  const [configPath, setConfigPath] = useState("");
  const [editingConfigPath, setEditingConfigPath] = useState(false);
  const [draftConfigPath, setDraftConfigPath] = useState("");
  const [profiles, setProfiles] = useState<SSHConfigProfile[]>([]);
  const [sshError, setSshError] = useState<string | null>(null);

  // Form for add / edit
  const [showForm, setShowForm] = useState(false);
  const [editingHost, setEditingHost] = useState<string | null>(null); // null = new
  const [form, setForm] = useState<EntryFormState>(blankForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Load config path + profiles on open ──────────────────────────────────
  const loadProfiles = useCallback(async (path: string) => {
    setSshError(null);
    const result = await window.electron.sshConfig.read(path);
    if (result.ok && result.data) {
      setProfiles(result.data);
    } else {
      setProfiles([]);
      if (result.error && !result.error.includes("ENOENT")) {
        setSshError(result.error);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const pathResult = await window.electron.sshConfig.getPath();
      const p =
        pathResult.ok && pathResult.data ? pathResult.data : "~/.ssh/config";
      setConfigPath(p);
      setDraftConfigPath(p);
      await loadProfiles(p);
    })();
  }, [loadProfiles]);

  // ─── Keyboard close ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        if (showForm) {
          setShowForm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showForm]);

  // ─── Config path editing ───────────────────────────────────────────────────
  const saveConfigPath = async (): Promise<void> => {
    const p = draftConfigPath.trim();
    if (!p) return;
    await window.electron.sshConfig.setPath(p);
    setConfigPath(p);
    setEditingConfigPath(false);
    await loadProfiles(p);
  };

  // ─── Entry form helpers ────────────────────────────────────────────────────
  const openNewForm = (): void => {
    setForm(blankForm());
    setEditingHost(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (profile: SSHConfigProfile): void => {
    setForm(profileToForm(profile));
    setEditingHost(profile.host);
    setFormError(null);
    setShowForm(true);
  };

  const cancelForm = (): void => {
    setShowForm(false);
    setFormError(null);
  };

  const setField = <K extends keyof EntryFormState>(
    key: K,
    value: EntryFormState[K],
  ): void => setForm((f) => ({ ...f, [key]: value }));

  const saveEntry = async (): Promise<void> => {
    if (!form.host.trim()) {
      setFormError("Alias is required");
      return;
    }
    if (!form.hostname.trim()) {
      setFormError("Hostname is required");
      return;
    }
    if (!form.user.trim()) {
      setFormError("User is required");
      return;
    }

    setSaving(true);
    setFormError(null);

    // If alias was renamed, delete the old entry first
    if (editingHost && editingHost !== form.host) {
      await window.electron.sshConfig.delete({ host: editingHost });
    }

    const result = await window.electron.sshConfig.write({
      entry: {
        host: form.host.trim(),
        hostname: form.hostname.trim(),
        port: form.port,
        user: form.user.trim(),
        identityFile: form.identityFile,
      },
      privateKeyContent: form.privateKeyContent || undefined,
    });

    setSaving(false);

    if (!result.ok) {
      setFormError(result.error ?? "Failed to save entry");
      return;
    }

    setShowForm(false);
    await loadProfiles(configPath);
  };

  const deleteEntry = async (hostAlias: string): Promise<void> => {
    await window.electron.sshConfig.delete({ host: hostAlias });
    await loadProfiles(configPath);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl shadow-black/60 w-full max-w-xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-600/20 border border-accent-500/30 flex items-center justify-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="text-accent-400"
              >
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-100">
                Settings
              </h2>
              <p className="text-xs text-surface-500">
                Customize your Tether experience
              </p>
            </div>
          </div>
          <button
            className="btn-ghost p-1.5 rounded-lg"
            onClick={onClose}
            title="Close"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">
          {/* ── Theme ─────────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
              Theme
            </p>
            <div className="grid grid-cols-5 gap-2.5">
              {THEMES.map((t) => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    title={t.name}
                    className={`
                      group flex flex-col items-center gap-2 p-0.5 rounded-xl transition-all
                      ${
                        isActive
                          ? "ring-2 ring-accent-500 ring-offset-2 ring-offset-surface-900"
                          : "ring-1 ring-surface-700 hover:ring-surface-500"
                      }
                    `}
                  >
                    <div
                      className="w-full h-16 rounded-lg overflow-hidden relative"
                      style={{ background: t.bg }}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 h-8 rounded-t-md"
                        style={{ background: t.panel }}
                      />
                      <div
                        className="absolute top-2 left-2 right-2 h-1.5 rounded-full"
                        style={{ background: t.accent }}
                      />
                      <div
                        className="absolute bottom-2.5 left-2 w-8 h-1 rounded-full opacity-70"
                        style={{ background: t.text }}
                      />
                      <div
                        className="absolute bottom-1 left-2 w-5 h-1 rounded-full opacity-40"
                        style={{ background: t.text }}
                      />
                      {isActive && (
                        <div
                          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: t.accent }}
                        >
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 16 16"
                            fill="white"
                          >
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium pb-0.5 ${isActive ? "text-surface-100" : "text-surface-400 group-hover:text-surface-300"}`}
                    >
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── SSH Config ─────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                SSH Config
              </p>
              {!showForm && (
                <button
                  className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                  onClick={openNewForm}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z" />
                  </svg>
                  Add Entry
                </button>
              )}
            </div>

            {/* Config file path */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-surface-500 flex-shrink-0">
                Config file:
              </span>
              {editingConfigPath ? (
                <>
                  <input
                    className="input text-xs flex-1 h-6 py-0"
                    value={draftConfigPath}
                    onChange={(e) => setDraftConfigPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveConfigPath();
                      if (e.key === "Escape") {
                        setDraftConfigPath(configPath);
                        setEditingConfigPath(false);
                      }
                    }}
                    autoFocus
                    spellCheck={false}
                  />
                  <button
                    className="btn-ghost text-xs py-0.5 px-2"
                    onClick={saveConfigPath}
                  >
                    Save
                  </button>
                  <button
                    className="btn-ghost text-xs py-0.5 px-2"
                    onClick={() => {
                      setDraftConfigPath(configPath);
                      setEditingConfigPath(false);
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs text-surface-300 font-mono flex-1 truncate">
                    {configPath}
                  </span>
                  <button
                    className="btn-ghost text-xs py-0.5 px-2 flex-shrink-0"
                    onClick={() => {
                      setDraftConfigPath(configPath);
                      setEditingConfigPath(true);
                    }}
                  >
                    Change
                  </button>
                </>
              )}
            </div>

            {/* Error */}
            {sshError && <p className="text-xs text-danger mb-2">{sshError}</p>}

            {/* Entry list */}
            {profiles.length > 0 && (
              <div className="rounded-lg border border-surface-800 overflow-hidden mb-3">
                {profiles.map((p, i) => (
                  <div
                    key={p.host}
                    className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-surface-800" : ""} hover:bg-surface-800/40 group`}
                  >
                    {/* Icon */}
                    <div className="w-6 h-6 rounded bg-accent-600/15 border border-accent-500/20 flex items-center justify-center flex-shrink-0">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="text-accent-400"
                      >
                        <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm5.904-2.803a.5.5 0 1 0-.707.707L6.586 7.293l-1.39 1.39a.5.5 0 0 0 .707.707l1.39-1.39 1.39 1.39a.5.5 0 0 0 .707-.707L8 7.293l1.39-1.39a.5.5 0 0 0-.707-.707L7.293 6.586l-1.39-1.389z" />
                      </svg>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-surface-100 font-mono truncate">
                          {p.host}
                        </span>
                        {p.identityFile && (
                          <span className="text-xs text-accent-400 bg-accent-600/10 px-1.5 py-0.5 rounded flex-shrink-0">
                            key
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 truncate">
                        {p.user ? `${p.user}@` : ""}
                        {p.hostname}
                        {p.port !== 22 ? `:${p.port}` : ""}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="btn-ghost p-1 rounded"
                        title="Edit"
                        onClick={() => openEditForm(p)}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z" />
                        </svg>
                      </button>
                      <button
                        className="btn-ghost p-1 rounded hover:text-danger"
                        title="Delete"
                        onClick={() => deleteEntry(p.host)}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                          <path
                            fillRule="evenodd"
                            d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {profiles.length === 0 && !showForm && (
              <p className="text-xs text-surface-600 italic">
                No entries in config file.
              </p>
            )}

            {/* Add / Edit form */}
            {showForm && (
              <div className="rounded-lg border border-surface-700 bg-surface-950/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-surface-300">
                  {editingHost ? "Edit Entry" : "New Entry"}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Alias */}
                  <div>
                    <label className="block text-xs text-surface-400 mb-1">
                      Alias
                    </label>
                    <input
                      className="input text-xs"
                      placeholder="myserver"
                      value={form.host}
                      onChange={(e) => setField("host", e.target.value)}
                      spellCheck={false}
                      autoFocus
                    />
                  </div>

                  {/* Hostname */}
                  <div>
                    <label className="block text-xs text-surface-400 mb-1">
                      Host
                    </label>
                    <input
                      className="input text-xs"
                      placeholder="192.168.1.1"
                      value={form.hostname}
                      onChange={(e) => setField("hostname", e.target.value)}
                      spellCheck={false}
                    />
                  </div>

                  {/* User */}
                  <div>
                    <label className="block text-xs text-surface-400 mb-1">
                      User
                    </label>
                    <input
                      className="input text-xs"
                      placeholder="root"
                      value={form.user}
                      onChange={(e) => setField("user", e.target.value)}
                      spellCheck={false}
                    />
                  </div>

                  {/* Port */}
                  <div>
                    <label className="block text-xs text-surface-400 mb-1">
                      Port
                    </label>
                    <input
                      className="input text-xs"
                      type="number"
                      min={1}
                      max={65535}
                      value={form.port}
                      onChange={(e) =>
                        setField("port", parseInt(e.target.value, 10) || 22)
                      }
                    />
                  </div>
                </div>

                {/* Private key */}
                <div>
                  <label className="block text-xs text-surface-400 mb-1">
                    Private Key{" "}
                    <span className="text-surface-600">
                      (optional — saved to ~/.ssh/)
                    </span>
                  </label>
                  <textarea
                    className="input font-mono text-xs resize-none h-20"
                    placeholder="Paste PEM private key here to save it to disk…"
                    value={form.privateKeyContent}
                    onChange={(e) =>
                      setField("privateKeyContent", e.target.value)
                    }
                    spellCheck={false}
                  />
                  {form.identityFile && !form.privateKeyContent && (
                    <p className="text-xs text-surface-500 mt-1">
                      Current key: {form.identityFile}
                    </p>
                  )}
                </div>

                {formError && (
                  <p className="text-xs text-danger">{formError}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button className="btn-ghost text-xs" onClick={cancelForm}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary text-xs"
                    onClick={saveEntry}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : editingHost ? "Update" : "Add"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-surface-800 bg-surface-950/50 flex-shrink-0">
          <button className="btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
