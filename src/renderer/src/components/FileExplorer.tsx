import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { FileEntry } from "../../../shared/types";
import { FileEditorDialog } from "./FileEditorDialog";
import folderIcon from "../assets/folder-default.svg";
import fileIcon from "../assets/file-default.svg";

interface FileExplorerProps {
  connectionId: string;
  currentPath: string;
  onPathChange: (path: string) => void;
  onJumpToFolder?: (path: string) => void;
  onOpenInVSCode?: (connectionId: string, path: string) => void;
}

type SortKey = "name" | "size" | "modified";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "grid";

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FileIcon({
  entry,
  size = 14,
}: {
  entry: FileEntry;
  size?: number;
}): JSX.Element {
  if (entry.isDirectory) {
    return (
      <img
        src={folderIcon}
        width={size}
        height={size}
        alt=""
        className="flex-shrink-0"
        draggable={false}
      />
    );
  }
  return (
    <img
      src={fileIcon}
      width={size}
      height={size}
      alt=""
      className="flex-shrink-0"
      draggable={false}
    />
  );
}

export function FileExplorer({
  connectionId,
  currentPath,
  onPathChange,
  onJumpToFolder,
  onOpenInVSCode,
}: FileExplorerProps): JSX.Element {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const loadDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      const result = await window.electron.sftp.list({ connectionId, path });
      setLoading(false);
      if (result.ok && result.data) {
        setEntries(result.data.entries);
      } else {
        setError(result.error ?? "Failed to list directory");
      }
    },
    [connectionId],
  );

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (newFolderMode && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [newFolderMode]);

  const sortEntries = (items: FileEntry[]): FileEntry[] =>
    [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "size") cmp = a.size - b.size;
      else cmp = a.modifiedAt - b.modifiedAt;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const folders = sortEntries(entries.filter((e) => e.isDirectory));
  const files = sortEntries(entries.filter((e) => !e.isDirectory));

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const navigate = (entry: FileEntry): void => {
    if (entry.isDirectory) {
      onPathChange(entry.path);
      setSelected(null);
    } else {
      setEditingFile(entry);
    }
  };

  const goUp = (): void => {
    if (currentPath === "/") return;
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    onPathChange(parent);
    setSelected(null);
  };

  const handleDownload = async (entry: FileEntry): Promise<void> => {
    await window.electron.sftp.download({
      connectionId,
      remotePath: entry.path,
      localPath: "",
    });
  };

  const handleDelete = async (entry: FileEntry): Promise<void> => {
    if (!confirm(`Delete "${entry.name}"?`)) return;
    const result = await window.electron.sftp.delete({
      connectionId,
      path: entry.path,
      isDirectory: entry.isDirectory,
    });
    if (result.ok) {
      loadDirectory(currentPath);
    } else {
      alert(result.error);
    }
  };

  const startRename = (entry: FileEntry): void => {
    setRenaming(entry.path);
    setRenameValue(entry.name);
  };

  const commitRename = async (): Promise<void> => {
    if (!renaming || !renameValue.trim()) {
      setRenaming(null);
      return;
    }
    const dir = renaming.split("/").slice(0, -1).join("/") || "/";
    const newPath = `${dir}/${renameValue.trim()}`;
    const result = await window.electron.sftp.rename({
      connectionId,
      oldPath: renaming,
      newPath,
    });
    setRenaming(null);
    if (result.ok) loadDirectory(currentPath);
    else alert(result.error);
  };

  const commitNewFolder = async (): Promise<void> => {
    const name = newFolderName.trim();
    setNewFolderMode(false);
    setNewFolderName("");
    if (!name) return;
    const path = `${currentPath === "/" ? "" : currentPath}/${name}`;
    const result = await window.electron.sftp.mkdir({ connectionId, path });
    if (result.ok) loadDirectory(currentPath);
    else alert(result.error);
  };

  const openContextMenu = (e: React.MouseEvent, entry: FileEntry): void => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
    setSelected(entry.path);
  };

  const closeContextMenu = (): void => setContextMenu(null);

  const SortIcon = ({ k }: { k: SortKey }): JSX.Element | null => {
    if (sortKey !== k) return null;
    return <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const pathSegments = currentPath.split("/").filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-surface-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 h-8 bg-surface-900 border-b border-surface-800 flex-shrink-0">
        <span className="text-xs text-surface-400 font-medium tracking-wide uppercase">
          Files
        </span>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost p-1 rounded"
            title="Refresh"
            onClick={() => loadDirectory(currentPath)}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"
              />
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
            </svg>
          </button>
          <button
            className="btn-ghost p-1 rounded"
            title="New Folder"
            onClick={() => setNewFolderMode(true)}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.19a2 2 0 0 1 1.45.63l.79.87H14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-8l.54-.63zM8 6.5a.5.5 0 0 0-1 0V8H5.5a.5.5 0 0 0 0 1H7v1.5a.5.5 0 0 0 1 0V9h1.5a.5.5 0 0 0 0-1H8V6.5z" />
            </svg>
          </button>
          <div className="w-px h-3 bg-surface-700 mx-0.5" />
          <button
            className={`p-1 rounded transition-colors ${viewMode === "list" ? "text-accent-400 bg-accent-600/15" : "btn-ghost"}`}
            title="List view"
            onClick={() => setViewMode("list")}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"
              />
            </svg>
          </button>
          <button
            className={`p-1 rounded transition-colors ${viewMode === "grid" ? "text-accent-400 bg-accent-600/15" : "btn-ghost"}`}
            title="Grid view"
            onClick={() => setViewMode("grid")}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-surface-900/60 border-b border-surface-800/60 flex-shrink-0 overflow-x-auto no-scrollbar">
        <button
          className="text-xs text-accent-400 hover:text-accent-300 font-mono flex-shrink-0"
          onClick={() => onPathChange("/")}
        >
          /
        </button>
        {pathSegments.map((seg, i) => {
          const segPath = "/" + pathSegments.slice(0, i + 1).join("/");
          return (
            <React.Fragment key={segPath}>
              <span className="text-surface-600 text-xs flex-shrink-0">/</span>
              <button
                className="text-xs text-surface-300 hover:text-surface-100 font-mono truncate max-w-[120px] flex-shrink-0"
                onClick={() => onPathChange(segPath)}
                title={seg}
              >
                {seg}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading && (
          <div className="flex items-center justify-center h-16 text-surface-500 text-xs gap-2">
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
              <path d="M8 2 A6 6 0 0 1 14 8" />
            </svg>
            Loading...
          </div>
        )}

        {error && (
          <div className="mx-3 mt-3 p-2 rounded bg-danger/10 border border-danger/30 text-xs text-danger/80">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* New folder input — shown in both views */}
            {newFolderMode && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-600/10 border-b border-accent-600/20">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="text-yellow-400 flex-shrink-0"
                >
                  <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.19a2 2 0 0 1 1.45.63l.79.87H14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4.5l.54-.63z" />
                </svg>
                <input
                  ref={newFolderInputRef}
                  className="input py-0.5 text-xs h-6 flex-1"
                  placeholder="New folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitNewFolder();
                    if (e.key === "Escape") {
                      setNewFolderMode(false);
                      setNewFolderName("");
                    }
                  }}
                  onBlur={commitNewFolder}
                />
              </div>
            )}

            {viewMode === "list" ? (
              <>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_60px_80px] gap-x-2 px-3 py-1 border-b border-surface-800/50 sticky top-0 bg-surface-950/95 backdrop-blur-sm z-10">
                  <button
                    className="text-left text-xs text-surface-500 hover:text-surface-300 font-medium"
                    onClick={() => handleSort("name")}
                  >
                    Name <SortIcon k="name" />
                  </button>
                  <button
                    className="text-right text-xs text-surface-500 hover:text-surface-300 font-medium"
                    onClick={() => handleSort("size")}
                  >
                    Size <SortIcon k="size" />
                  </button>
                  <button
                    className="text-right text-xs text-surface-500 hover:text-surface-300 font-medium"
                    onClick={() => handleSort("modified")}
                  >
                    Modified <SortIcon k="modified" />
                  </button>
                </div>

                {/* Go up */}
                {currentPath !== "/" && (
                  <button
                    className="w-full grid grid-cols-[1fr_60px_80px] gap-x-2 px-3 py-1.5 text-left hover:bg-surface-800/40 transition-colors group"
                    onClick={goUp}
                  >
                    <span className="flex items-center gap-2 text-xs text-surface-400 group-hover:text-surface-200 min-w-0">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="text-surface-600 flex-shrink-0"
                      >
                        <path
                          fillRule="evenodd"
                          d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"
                        />
                      </svg>
                      <span className="truncate font-mono">..</span>
                    </span>
                    <span />
                    <span />
                  </button>
                )}

                {/* List entries */}
                {folders.length > 0 && (
                  <div className="grid grid-cols-[1fr_60px_80px] gap-x-2 px-3 py-1 mt-0.5">
                    <span className="text-xs text-surface-600 font-medium uppercase tracking-wider">
                      Folders
                    </span>
                  </div>
                )}
                {folders.map((entry) => (
                  <div
                    key={entry.path}
                    className={`group grid grid-cols-[1fr_60px_80px] gap-x-2 px-3 py-1.5 cursor-pointer transition-colors ${
                      selected === entry.path
                        ? "bg-accent-600/15 border-l-2 border-accent-500"
                        : "hover:bg-surface-800/40 border-l-2 border-transparent"
                    }`}
                    onClick={() => setSelected(entry.path)}
                    onDoubleClick={() => navigate(entry)}
                    onContextMenu={(e) => openContextMenu(e, entry)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon entry={entry} />
                      {renaming === entry.path ? (
                        <input
                          ref={renameInputRef}
                          className="input py-0 text-xs h-5 min-w-0 flex-1"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          onBlur={commitRename}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={`text-xs truncate font-mono ${entry.isDirectory ? "text-surface-200" : "text-surface-300"}`}
                        >
                          {entry.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-surface-500 text-right self-center">
                      {entry.isDirectory ? "—" : formatSize(entry.size)}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-xs text-surface-600 truncate">
                        {formatDate(entry.modifiedAt)}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        {!entry.isDirectory && (
                          <button
                            className="p-0.5 rounded hover:text-accent-400 text-surface-600 transition-colors"
                            title="Download"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(entry);
                            }}
                          >
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="p-0.5 rounded hover:text-surface-200 text-surface-600 transition-colors"
                          title="Rename"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(entry);
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5z" />
                            <path d="M3 10.5V11h-.5a.5.5 0 0 0-.5.5V12h-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5H3a.5.5 0 0 0 .354-.146l.75-.75-.354-.354-.75.75H1v-1h.5a.5.5 0 0 0 .5-.5V12h.5a.5.5 0 0 0 .5-.5V11h.5a.5.5 0 0 0 .5-.5V10H3z" />
                          </svg>
                        </button>
                        <button
                          className="p-0.5 rounded hover:text-danger text-surface-600 transition-colors"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry);
                          }}
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
                  </div>
                ))}
                {files.length > 0 && (
                  <div className="grid grid-cols-[1fr_60px_80px] gap-x-2 px-3 py-1 mt-1 border-t border-surface-800/50">
                    <span className="text-xs text-surface-600 font-medium uppercase tracking-wider">
                      Files
                    </span>
                  </div>
                )}
                {files.map((entry) => (
                  <div
                    key={entry.path}
                    className={`group grid grid-cols-[1fr_60px_80px] gap-x-2 px-3 py-1.5 cursor-pointer transition-colors ${
                      selected === entry.path
                        ? "bg-accent-600/15 border-l-2 border-accent-500"
                        : "hover:bg-surface-800/40 border-l-2 border-transparent"
                    }`}
                    onClick={() => setSelected(entry.path)}
                    onDoubleClick={() => navigate(entry)}
                    onContextMenu={(e) => openContextMenu(e, entry)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon entry={entry} />
                      {renaming === entry.path ? (
                        <input
                          ref={renameInputRef}
                          className="input py-0 text-xs h-5 min-w-0 flex-1"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          onBlur={commitRename}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-xs truncate font-mono text-surface-300">
                          {entry.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-surface-500 text-right self-center">
                      {formatSize(entry.size)}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-xs text-surface-600 truncate">
                        {formatDate(entry.modifiedAt)}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          className="p-0.5 rounded hover:text-accent-400 text-surface-600 transition-colors"
                          title="Download"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(entry);
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                          </svg>
                        </button>
                        <button
                          className="p-0.5 rounded hover:text-surface-200 text-surface-600 transition-colors"
                          title="Rename"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(entry);
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5z" />
                            <path d="M3 10.5V11h-.5a.5.5 0 0 0-.5.5V12h-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5H3a.5.5 0 0 0 .354-.146l.75-.75-.354-.354-.75.75H1v-1h.5a.5.5 0 0 0 .5-.5V12h.5a.5.5 0 0 0 .5-.5V11h.5a.5.5 0 0 0 .5-.5V10H3z" />
                          </svg>
                        </button>
                        <button
                          className="p-0.5 rounded hover:text-danger text-surface-600 transition-colors"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry);
                          }}
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
                  </div>
                ))}
              </>
            ) : (
              /* Grid view */
              <div className="p-2">
                {/* Go up tile */}
                {currentPath !== "/" && (
                  <button
                    className="inline-flex flex-col items-center justify-center gap-2 w-28 p-2 rounded-lg text-left hover:bg-surface-800/50 transition-colors group"
                    onClick={goUp}
                    title="Go up"
                  >
                    <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-surface-800/60 group-hover:bg-surface-700/60 transition-colors">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="text-surface-500"
                      >
                        <path
                          fillRule="evenodd"
                          d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"
                        />
                      </svg>
                    </div>
                    <span className="text-xs text-surface-500 group-hover:text-surface-300 font-mono truncate w-full text-center">
                      ..
                    </span>
                  </button>
                )}

                {/* Folders section */}
                {folders.length > 0 && (
                  <>
                    <p className="px-1 pb-1 pt-0.5 text-xs text-surface-600 font-medium uppercase tracking-wider">
                      Folders
                    </p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {folders.map((entry) => (
                        <GridTile
                          key={entry.path}
                          entry={entry}
                          selected={selected}
                          renaming={renaming}
                          renameValue={renameValue}
                          renameInputRef={renameInputRef}
                          onSelect={setSelected}
                          onNavigate={navigate}
                          onContextMenu={openContextMenu}
                          onRenameChange={setRenameValue}
                          onRenameCommit={commitRename}
                          onRenameCancel={() => setRenaming(null)}
                          onDownload={handleDownload}
                          onStartRename={startRename}
                          onDelete={handleDelete}
                          formatSize={formatSize}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Files section */}
                {files.length > 0 && (
                  <>
                    {folders.length > 0 && (
                      <div className="border-t border-surface-800/50 mb-2" />
                    )}
                    <p className="px-1 pb-1 text-xs text-surface-600 font-medium uppercase tracking-wider">
                      Files
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {files.map((entry) => (
                        <GridTile
                          key={entry.path}
                          entry={entry}
                          selected={selected}
                          renaming={renaming}
                          renameValue={renameValue}
                          renameInputRef={renameInputRef}
                          onSelect={setSelected}
                          onNavigate={navigate}
                          onContextMenu={openContextMenu}
                          onRenameChange={setRenameValue}
                          onRenameCommit={commitRename}
                          onRenameCancel={() => setRenaming(null)}
                          onDownload={handleDownload}
                          onStartRename={startRename}
                          onDelete={handleDelete}
                          formatSize={formatSize}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {!loading && entries.length === 0 && (
              <div className="flex items-center justify-center h-16 text-surface-600 text-xs">
                Empty directory
              </div>
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-surface-900 border-t border-surface-800 flex-shrink-0">
        <span className="text-xs text-surface-600 font-mono truncate">
          {currentPath}
        </span>
        <span className="text-xs text-surface-600 flex-shrink-0 ml-2">
          {entries.length} items
        </span>
      </div>

      {/* Context menu portal */}
      {contextMenu &&
        (() => {
          const cm = contextMenu;
          return createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={closeContextMenu}
                onContextMenu={(e) => {
                  e.preventDefault();
                  closeContextMenu();
                }}
              />
              <ContextMenuPopup
                x={cm.x}
                y={cm.y}
                entry={cm.entry}
                onClose={closeContextMenu}
                onEdit={
                  !cm.entry.isDirectory
                    ? () => {
                        closeContextMenu();
                        setEditingFile(cm.entry);
                      }
                    : undefined
                }
                onRename={() => {
                  closeContextMenu();
                  startRename(cm.entry);
                }}
                onDelete={() => {
                  closeContextMenu();
                  handleDelete(cm.entry);
                }}
                onDownload={() => {
                  closeContextMenu();
                  handleDownload(cm.entry);
                }}
                onJumpToFolder={
                  onJumpToFolder
                    ? () => {
                        closeContextMenu();
                        onJumpToFolder(cm.entry.path);
                      }
                    : undefined
                }
                onOpenInVSCode={
                  onOpenInVSCode
                    ? () => {
                        closeContextMenu();
                        onOpenInVSCode(connectionId, cm.entry.path);
                      }
                    : undefined
                }
              />
            </>,
            document.body,
          );
        })()}

      {/* File editor */}
      {editingFile && (
        <FileEditorDialog
          connectionId={connectionId}
          file={editingFile}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}

// ─── Grid tile ───────────────────────────────────────────────────────────────

interface GridTileProps {
  entry: FileEntry;
  selected: string | null;
  renaming: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement>;
  onSelect: (path: string) => void;
  onNavigate: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDownload: (entry: FileEntry) => void;
  onStartRename: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
  formatSize: (bytes: number) => string;
}

function GridTile({
  entry,
  selected,
  renaming,
  renameValue,
  renameInputRef,
  onSelect,
  onNavigate,
  onContextMenu,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onDownload,
  onStartRename,
  onDelete,
  formatSize,
}: GridTileProps): JSX.Element {
  return (
    <div
      className={`group relative flex flex-col items-center justify-start gap-2 w-28 p-2 rounded-lg cursor-pointer transition-colors ${
        selected === entry.path
          ? "bg-accent-600/20 ring-1 ring-accent-500/50"
          : "hover:bg-surface-800/50"
      }`}
      onClick={() => onSelect(entry.path)}
      onDoubleClick={() => onNavigate(entry)}
      onContextMenu={(e) => onContextMenu(e, entry)}
      title={`${entry.name}${!entry.isDirectory ? ` · ${formatSize(entry.size)}` : ""}`}
    >
      {/* Icon */}
      <div
        className={`w-14 h-14 flex items-center justify-center rounded-xl transition-colors ${
          selected === entry.path
            ? "bg-accent-600/20"
            : "bg-surface-800/60 group-hover:bg-surface-700/60"
        }`}
      >
        <FileIcon entry={entry} size={40} />
      </div>

      {/* Name */}
      {renaming === entry.path ? (
        <input
          ref={renameInputRef}
          className="input py-0 text-xs h-5 w-full text-center"
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameCommit();
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={onRenameCommit}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`text-xs font-mono text-center leading-tight line-clamp-2 break-all w-full ${
            entry.isDirectory ? "text-surface-200" : "text-surface-300"
          }`}
        >
          {entry.name}
        </span>
      )}

      {/* Hover actions */}
      <div className="hidden group-hover:flex absolute top-1 right-1 flex-col gap-0.5 bg-surface-900/90 rounded p-0.5">
        {!entry.isDirectory && (
          <button
            className="p-0.5 rounded hover:text-accent-400 text-surface-500 transition-colors"
            title="Download"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(entry);
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
            </svg>
          </button>
        )}
        <button
          className="p-0.5 rounded hover:text-surface-200 text-surface-500 transition-colors"
          title="Rename"
          onClick={(e) => {
            e.stopPropagation();
            onStartRename(entry);
          }}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5z" />
            <path d="M3 10.5V11h-.5a.5.5 0 0 0-.5.5V12h-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5H3a.5.5 0 0 0 .354-.146l.75-.75-.354-.354-.75.75H1v-1h.5a.5.5 0 0 0 .5-.5V12h.5a.5.5 0 0 0 .5-.5V11h.5a.5.5 0 0 0 .5-.5V10H3z" />
          </svg>
        </button>
        <button
          className="p-0.5 rounded hover:text-danger text-surface-500 transition-colors"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
            <path
              fillRule="evenodd"
              d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Context menu popup ───────────────────────────────────────────────────────

interface ContextMenuPopupProps {
  x: number;
  y: number;
  entry: FileEntry;
  onClose: () => void;
  onEdit?: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onJumpToFolder?: () => void;
  onOpenInVSCode?: () => void;
}

function ContextMenuPopup({
  x,
  y,
  entry,
  onEdit,
  onRename,
  onDelete,
  onDownload,
  onJumpToFolder,
  onOpenInVSCode,
}: ContextMenuPopupProps): JSX.Element {
  // Keep within viewport
  const menuWidth = 192;
  const adjustedX =
    x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 8 : x;

  const Item = ({
    icon,
    label,
    onClick,
    danger,
  }: {
    icon: JSX.Element;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }): JSX.Element => (
    <button
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors rounded ${
        danger
          ? "text-danger/80 hover:bg-danger/10 hover:text-danger"
          : "text-surface-300 hover:bg-surface-700/60 hover:text-surface-100"
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className="fixed z-[9999] min-w-48 bg-surface-900 border border-surface-700/80 rounded-lg shadow-2xl shadow-black/50 p-1 backdrop-blur-sm"
      style={{ left: adjustedX, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Entry header */}
      <div className="flex items-center gap-2 px-3 py-1.5 mb-0.5 border-b border-surface-800">
        <FileIcon entry={entry} size={12} />
        <span className="text-xs text-surface-400 font-mono truncate max-w-[140px]">
          {entry.name}
        </span>
      </div>

      {entry.isDirectory && onJumpToFolder && (
        <Item
          label="Open Terminal Here"
          onClick={onJumpToFolder}
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="flex-shrink-0"
            >
              <path d="M6 9a.5.5 0 0 1 .5-.5h3.793l-1.147-1.146a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L10.293 9.5H6.5A.5.5 0 0 1 6 9z" />
              <path d="M3.5 3.5A.5.5 0 0 0 3 4v8a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V8a.5.5 0 0 1 1 0v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4a1.5 1.5 0 0 1 1.5-1.5h5a.5.5 0 0 1 0 1h-5z" />
            </svg>
          }
        />
      )}

      {entry.isDirectory && onOpenInVSCode && (
        <Item
          label="Open in VS Code"
          onClick={onOpenInVSCode}
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="flex-shrink-0"
            >
              <path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z" />
            </svg>
          }
        />
      )}

      {entry.isDirectory && (onJumpToFolder || onOpenInVSCode) && (
        <div className="my-0.5 border-t border-surface-800" />
      )}

      {onEdit && (
        <Item
          label="Edit"
          onClick={onEdit}
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="flex-shrink-0"
            >
              <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
            </svg>
          }
        />
      )}

      <Item
        label="Rename"
        onClick={onRename}
        icon={
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="flex-shrink-0"
          >
            <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5z" />
            <path d="M3 10.5V11h-.5a.5.5 0 0 0-.5.5V12h-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5H3a.5.5 0 0 0 .354-.146l.75-.75-.354-.354-.75.75H1v-1h.5a.5.5 0 0 0 .5-.5V12h.5a.5.5 0 0 0 .5-.5V11h.5a.5.5 0 0 0 .5-.5V10H3z" />
          </svg>
        }
      />

      {!entry.isDirectory && (
        <Item
          label="Download"
          onClick={onDownload}
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="flex-shrink-0"
            >
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
            </svg>
          }
        />
      )}

      <div className="my-0.5 border-t border-surface-800" />

      <Item
        label="Delete"
        onClick={onDelete}
        danger
        icon={
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="flex-shrink-0"
          >
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
            <path
              fillRule="evenodd"
              d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
            />
          </svg>
        }
      />
    </div>
  );
}
