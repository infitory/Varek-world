import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { renderMarkdown } from "../lib/markdown";
import { SafeHtml } from "./SafeHtml";

interface Props {
  relativePath: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onInternalLink: (path: string, anchor: string | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  showPreview: boolean;
}

function draftKey(relativePath: string): string {
  return `varek-draft::${relativePath}`;
}

export function Editor({
  relativePath,
  initialContent,
  onSave,
  onInternalLink,
  onDirtyChange,
  showPreview,
}: Props) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(draftKey(relativePath));
    return stored ?? initialContent;
  });
  const [saving, setSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const valueRef = useRef(value);
  valueRef.current = value;

  // When the entry changes (navigation), reset state, honouring any draft.
  useEffect(() => {
    const stored = localStorage.getItem(draftKey(relativePath));
    const initial = stored ?? initialContent;
    setValue(initial);
    setLastSavedContent(initialContent);
  }, [relativePath, initialContent]);

  // Auto-save draft to localStorage while editing.
  useEffect(() => {
    if (value === lastSavedContent) {
      localStorage.removeItem(draftKey(relativePath));
      onDirtyChange?.(false);
    } else {
      localStorage.setItem(draftKey(relativePath), value);
      onDirtyChange?.(true);
    }
  }, [value, lastSavedContent, relativePath, onDirtyChange]);

  const doSave = useCallback(async () => {
    if (saving) return;
    const current = valueRef.current;
    if (current === lastSavedContent) return;
    setSaving(true);
    try {
      await onSave(current);
      setLastSavedContent(current);
      localStorage.removeItem(draftKey(relativePath));
    } finally {
      setSaving(false);
    }
  }, [saving, lastSavedContent, onSave, relativePath]);

  // Cmd/Ctrl+S to save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": { backgroundColor: "var(--bg)", color: "var(--text)" },
        ".cm-content": { caretColor: "var(--accent)" },
        ".cm-cursor": { borderLeftColor: "var(--accent)" },
        ".cm-gutters": {
          backgroundColor: "var(--bg-sunken)",
          color: "var(--text-faint)",
          border: "0",
        },
        ".cm-activeLineGutter": { backgroundColor: "var(--bg-hover)" },
        ".cm-activeLine": { backgroundColor: "var(--bg-raised)" },
        "&.cm-focused": { outline: "none" },
        ".cm-selectionBackground, ::selection": {
          backgroundColor: "var(--selection) !important",
        },
      }),
    ],
    [],
  );

  const previewHtml = useMemo(
    () => renderMarkdown(stripFrontMatter(value), relativePath),
    [value, relativePath],
  );

  return (
    <div className={`editor-wrap ${showPreview ? "" : "single"}`}>
      <div className="editor-pane">
        <CodeMirror
          value={value}
          height="100%"
          theme="dark"
          extensions={extensions}
          onChange={(v) => setValue(v)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            foldGutter: false,
          }}
        />
      </div>
      {showPreview && (
        <div className="editor-pane">
          <div className="view-wrap" style={{ padding: "24px 28px 80px" }}>
            <article className="view">
              <SafeHtml html={previewHtml} onInternalLink={onInternalLink} />
            </article>
          </div>
        </div>
      )}
    </div>
  );
}

// Strip the first `---\n...\n---` block (YAML frontmatter) so the preview
// doesn't render it as a horizontal rule followed by raw YAML.
function stripFrontMatter(text: string): string {
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return text;
  return text.slice(end + 4).replace(/^\n/, "");
}
