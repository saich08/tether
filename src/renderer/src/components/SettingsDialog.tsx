import React, { useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../context/ThemeContext";

interface SettingsDialogProps {
  onClose: () => void;
}

interface ThemeOption {
  id: Theme;
  name: string;
  /** Preview swatch colors (not Tailwind — hardcoded so they render before CSS vars load) */
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

export function SettingsDialog({ onClose }: SettingsDialogProps): JSX.Element {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl shadow-black/60 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
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

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* Theme section */}
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
                    {/* Swatch */}
                    <div
                      className="w-full h-16 rounded-lg overflow-hidden relative"
                      style={{ background: t.bg }}
                    >
                      {/* Fake panel */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-8 rounded-t-md"
                        style={{ background: t.panel }}
                      />
                      {/* Accent bar */}
                      <div
                        className="absolute top-2 left-2 right-2 h-1.5 rounded-full"
                        style={{ background: t.accent }}
                      />
                      {/* Fake text lines */}
                      <div
                        className="absolute bottom-2.5 left-2 w-8 h-1 rounded-full opacity-70"
                        style={{ background: t.text }}
                      />
                      <div
                        className="absolute bottom-1 left-2 w-5 h-1 rounded-full opacity-40"
                        style={{ background: t.text }}
                      />
                      {/* Active check */}
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
                    {/* Label */}
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-surface-800 bg-surface-950/50">
          <button className="btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
