import { useEffect, useMemo, useState } from "react";
import type { TreeNode } from "../lib/api";
import { api } from "../lib/api";

interface Props {
  tree: TreeNode[];
  onClose: () => void;
  onCreated: (relativePath: string) => void;
}

interface FolderOption {
  path: string;
  label: string;
  defaultType: string;
}

const FOLDER_CONVENTIONS: FolderOption[] = [
  { path: "characters", label: "characters/", defaultType: "Character" },
  { path: "kingdoms", label: "kingdoms/", defaultType: "Kingdom" },
  { path: "faiths", label: "faiths/", defaultType: "Religion" },
  { path: "history", label: "history/", defaultType: "History" },
  { path: "margins", label: "margins/", defaultType: "Phenomenon" },
  { path: "world", label: "world/", defaultType: "World overview" },
  { path: "story/chapters", label: "story/chapters/", defaultType: "Chapter" },
];

export function NewEntryModal({ tree, onClose, onCreated }: Props) {
  const existingFolders = useMemo(() => collectFolders(tree), [tree]);
  const folderOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: FolderOption[] = [];
    for (const opt of FOLDER_CONVENTIONS) {
      if (!seen.has(opt.path)) {
        out.push(opt);
        seen.add(opt.path);
      }
    }
    for (const path of existingFolders) {
      if (!seen.has(path)) {
        out.push({ path, label: `${path}/`, defaultType: "" });
        seen.add(path);
      }
    }
    return out;
  }, [existingFolders]);

  const [folder, setFolder] = useState(folderOptions[0]?.path ?? "characters");
  const [title, setTitle] = useState("");
  const [filename, setFilename] = useState("");
  const [typeField, setTypeField] = useState(
    folderOptions.find((f) => f.path === folder)?.defaultType ?? "",
  );
  const [statusField, setStatusField] = useState("Draft");
  const [filenameManuallyEdited, setFilenameManuallyEdited] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const conv = folderOptions.find((f) => f.path === folder);
    if (conv && conv.defaultType && !typeField) {
      setTypeField(conv.defaultType);
    }
  }, [folder, folderOptions, typeField]);

  useEffect(() => {
    if (!filenameManuallyEdited) {
      setFilename(title ? slug(title) + ".md" : "");
    }
  }, [title, filenameManuallyEdited]);

  async function submit() {
    setErr(null);
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(filename)) {
      setErr("Filename must be lowercase kebab-case ending in .md.");
      return;
    }
    const metadata: Record<string, string> = {};
    if (typeField.trim()) metadata.Type = typeField.trim();
    if (statusField.trim()) metadata.Status = statusField.trim();
    setBusy(true);
    try {
      const res = await api.createEntry({
        folder,
        filename,
        title: title.trim(),
        metadata,
        body: "",
      });
      onCreated(res.relativePath);
    } catch (e: any) {
      setErr(e?.message ?? "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">New entry</div>
          <button className="btn-ghost btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Folder</label>
            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              {folderOptions.map((opt) => (
                <option key={opt.path} value={opt.path}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="hint">
              Pick where this entry belongs. The compendium convention keeps
              the folder structure load-bearing.
            </div>
          </div>
          <div className="field">
            <label>Title</label>
            <input
              autoFocus
              value={title}
              placeholder="e.g. The Eastern Reach"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <div className="field">
            <label>Filename</label>
            <input
              value={filename}
              onChange={(e) => {
                setFilename(e.target.value);
                setFilenameManuallyEdited(true);
              }}
              placeholder="e.g. eastern-reach.md"
            />
            <div className="hint">Lowercase kebab-case, ending in .md.</div>
          </div>
          <div className="field">
            <label>Type</label>
            <input
              value={typeField}
              onChange={(e) => setTypeField(e.target.value)}
              placeholder="e.g. Character, Kingdom, Phenomenon"
            />
          </div>
          <div className="field">
            <label>Status</label>
            <input
              value={statusField}
              onChange={(e) => setStatusField(e.target.value)}
              placeholder="e.g. Draft, Canonical"
            />
          </div>
          {err && <div className="error">{err}</div>}
          <div className="hint">
            Creates:
            <code className="kbd" style={{ marginLeft: 6 }}>
              varek/{folder}/{filename || "…"}
            </code>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function collectFolders(tree: TreeNode[], prefix = ""): string[] {
  const out: string[] = [];
  for (const node of tree) {
    if (node.kind === "directory") {
      const full = prefix ? `${prefix}/${node.name}` : node.name;
      out.push(full);
      if (node.children) out.push(...collectFolders(node.children, full));
    }
  }
  return out;
}
