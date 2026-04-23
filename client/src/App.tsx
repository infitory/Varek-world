import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Entry, type Health, type TreeNode } from "./lib/api";
import { getTheme, setTheme as applyTheme, toggleTheme, type Theme } from "./lib/theme";
import { FileTree } from "./components/FileTree";
import { Viewer } from "./components/Viewer";
import { Editor } from "./components/Editor";
import { Backlinks } from "./components/Backlinks";
import { AiPanel } from "./components/AiPanel";
import { NewEntryModal } from "./components/NewEntryModal";
import { GlobalSearch } from "./components/GlobalSearch";

type Mode = "view" | "edit";

export function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [currentAnchor, setCurrentAnchor] = useState<string | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [isDirty, setIsDirty] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind?: "error" } | null>(null);

  // Theme setup
  useEffect(() => {
    const t = getTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  function flipTheme() {
    const next = toggleTheme(theme);
    setTheme(next);
    applyTheme(next);
  }

  // Initial data load
  useEffect(() => {
    Promise.all([api.tree(), api.health()])
      .then(([treeRes, healthRes]) => {
        setTree(treeRes.tree);
        setHealth(healthRes);
        // Default: open README.md if it exists.
        const readme = treeRes.tree.find(
          (n) => n.kind === "file" && n.name === "README.md",
        );
        if (readme) setCurrentPath(readme.relativePath);
      })
      .catch((err) => showToast(`Failed to load compendium: ${err.message}`, "error"));
  }, []);

  // Load the current entry when path changes
  useEffect(() => {
    if (!currentPath) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    api
      .entry(currentPath)
      .then((e) => {
        if (!cancelled) setEntry(e);
      })
      .catch((err) => {
        if (!cancelled) {
          showToast(`Could not open ${currentPath}: ${err.message}`, "error");
          setEntry(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentPath, refreshKey]);

  function showToast(text: string, kind?: "error") {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), kind === "error" ? 4000 : 2000);
  }

  const openEntry = useCallback(
    (path: string, anchor: string | null = null) => {
      if (isDirty && mode === "edit") {
        const confirmed = window.confirm(
          "You have unsaved changes. Switch entries anyway? (Your draft is kept in localStorage.)",
        );
        if (!confirmed) return;
      }
      setCurrentPath(path);
      setCurrentAnchor(anchor);
      setMode("view");
    },
    [isDirty, mode],
  );

  const onSave = useCallback(
    async (content: string) => {
      if (!currentPath) return;
      try {
        await api.saveEntry(currentPath, content);
        showToast("Saved.");
        setRefreshKey((k) => k + 1);
      } catch (err: any) {
        showToast(err?.message ?? "Save failed", "error");
        throw err;
      }
    },
    [currentPath],
  );

  // Global shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && e.shiftKey) {
        e.preventDefault();
        setShowNewModal(true);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowNewModal(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = useMemo(() => {
    if (!entry) return "";
    return entry.title ?? entry.relativePath;
  }, [entry]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">Varek</span>
          <span className="brand-sub">the Bone World</span>
        </div>
        <div className="topbar-right">
          <button className="btn" onClick={() => setShowSearch(true)}>
            Search <span className="kbd">⌘K</span>
          </button>
          <button className="btn" onClick={() => setShowNewModal(true)}>
            New entry
          </button>
          <button className="btn btn-ghost" onClick={flipTheme} title="Toggle theme">
            {theme === "dark" ? "☾" : "☀"}
          </button>
        </div>
      </header>

      <div className="panes">
        <aside className="pane pane-left">
          <FileTree
            tree={tree}
            currentPath={currentPath}
            onSelect={(p) => openEntry(p, null)}
          />
        </aside>

        <main className="pane pane-center">
          {entry ? (
            <>
              <div className="tabs">
                <div className="tabs-tabs">
                  <button
                    className={`tab ${mode === "view" ? "active" : ""}`}
                    onClick={() => setMode("view")}
                  >
                    View
                  </button>
                  <button
                    className={`tab ${mode === "edit" ? "active" : ""}`}
                    onClick={() => setMode("edit")}
                  >
                    Edit {isDirty && <span style={{ color: "var(--accent)" }}>•</span>}
                  </button>
                </div>
                <div className="tab-path">{entry.relativePath}</div>
                <div className="tab-actions">
                  {mode === "edit" && (
                    <>
                      <button
                        className="btn"
                        title="Save (⌘S / Ctrl+S)"
                        onClick={() => {
                          // The editor listens for Cmd/Ctrl+S itself. As a
                          // fallback, synthesize the same event.
                          const ev = new KeyboardEvent("keydown", {
                            key: "s",
                            metaKey: true,
                            ctrlKey: true,
                            bubbles: true,
                          });
                          window.dispatchEvent(ev);
                        }}
                      >
                        Save <span className="kbd">⌘S</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              {mode === "view" ? (
                <Viewer
                  entry={entry}
                  targetAnchor={currentAnchor}
                  onInternalLink={openEntry}
                />
              ) : (
                <Editor
                  key={`${entry.relativePath}::${refreshKey}`}
                  relativePath={entry.relativePath}
                  initialContent={entry.raw}
                  onSave={onSave}
                  onInternalLink={openEntry}
                  onDirtyChange={setIsDirty}
                  showPreview={true}
                />
              )}
            </>
          ) : (
            <Welcome />
          )}
        </main>

        <aside className="pane pane-right">
          {entry && (
            <>
              <Backlinks
                relativePath={entry.relativePath}
                onOpen={openEntry}
                refreshKey={refreshKey}
              />
              <AiPanel
                relativePath={entry.relativePath}
                hasApiKey={health?.hasApiKey ?? false}
                model={health?.model ?? "claude-opus-4-7"}
                onAccept={(text) => {
                  // Append generated text to the editor buffer. We do this
                  // by flipping to edit mode and mutating localStorage so
                  // the editor picks up the draft.
                  const key = `varek-draft::${entry.relativePath}`;
                  const existingDraft = localStorage.getItem(key);
                  const base = existingDraft ?? entry.raw;
                  const appended = ensureTrailingBlankLine(base) + text + "\n";
                  localStorage.setItem(key, appended);
                  setMode("edit");
                  // Force the editor to remount with fresh content by
                  // bumping the refresh key — this reloads the entry and
                  // the draft takes effect.
                  setRefreshKey((k) => k + 1);
                  showToast("AI output appended to draft. Save to persist.");
                }}
              />
            </>
          )}
        </aside>
      </div>

      {showNewModal && (
        <NewEntryModal
          tree={tree}
          onClose={() => setShowNewModal(false)}
          onCreated={(relativePath) => {
            setShowNewModal(false);
            refreshTree().then(() => openEntry(relativePath, null));
          }}
        />
      )}
      {showSearch && (
        <GlobalSearch
          onClose={() => setShowSearch(false)}
          onSelect={(p) => {
            setShowSearch(false);
            openEntry(p, null);
          }}
        />
      )}

      {toast && <div className={`toast ${toast.kind ?? ""}`}>{toast.text}</div>}
    </div>
  );

  async function refreshTree() {
    try {
      const t = await api.tree();
      setTree(t.tree);
    } catch (err: any) {
      showToast(err?.message ?? "Tree refresh failed", "error");
    }
  }
}

function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-title">Varek — the Bone World</div>
      <div className="welcome-sub">
        Pick an entry from the left, or press <span className="kbd">⌘K</span> to
        search, or <span className="kbd">New entry</span> to start one.
      </div>
    </div>
  );
}

function ensureTrailingBlankLine(s: string): string {
  if (s.endsWith("\n\n")) return s;
  if (s.endsWith("\n")) return s + "\n";
  return s + "\n\n";
}
