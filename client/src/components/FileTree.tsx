import { useEffect, useMemo, useState } from "react";
import type { TreeNode } from "../lib/api";

interface Props {
  tree: TreeNode[];
  currentPath: string | null;
  onSelect: (relativePath: string) => void;
}

const EXPANDED_KEY = "varek-tree-expanded";

export function FileTree({ tree, currentPath, onSelect }: Props) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(EXPANDED_KEY);
      if (stored) return new Set(JSON.parse(stored));
    } catch {
      /* ignore */
    }
    // Default: expand top-level directories.
    return new Set(tree.filter((n) => n.kind === "directory").map((n) => n.relativePath));
  });

  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(expanded)));
  }, [expanded]);

  // When filtering, auto-expand any dir that contains a match.
  const filteredExpanded = useMemo(() => {
    if (!filter.trim()) return expanded;
    const q = filter.toLowerCase();
    const auto = new Set(expanded);
    function walk(nodes: TreeNode[]): boolean {
      let anyMatch = false;
      for (const node of nodes) {
        if (node.kind === "directory" && node.children) {
          const childMatch = walk(node.children);
          if (childMatch) {
            auto.add(node.relativePath);
            anyMatch = true;
          }
        } else if (node.kind === "file") {
          if (
            node.relativePath.toLowerCase().includes(q) ||
            node.name.toLowerCase().includes(q)
          ) {
            anyMatch = true;
          }
        }
      }
      return anyMatch;
    }
    walk(tree);
    return auto;
  }, [filter, expanded, tree]);

  // Auto-expand the ancestors of the current file.
  useEffect(() => {
    if (!currentPath) return;
    const parts = currentPath.split("/");
    const ancestors: string[] = [];
    for (let i = 0; i < parts.length - 1; i++) {
      ancestors.push(parts.slice(0, i + 1).join("/"));
    }
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const a of ancestors) {
        if (!next.has(a)) {
          next.add(a);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentPath]);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const filterLower = filter.trim().toLowerCase();

  function matches(node: TreeNode): boolean {
    if (!filterLower) return true;
    if (node.kind === "file") {
      return (
        node.name.toLowerCase().includes(filterLower) ||
        node.relativePath.toLowerCase().includes(filterLower)
      );
    }
    if (node.children) return node.children.some(matches);
    return false;
  }

  function renderNode(node: TreeNode): JSX.Element | null {
    if (!matches(node)) return null;
    if (node.kind === "directory") {
      const isOpen = filteredExpanded.has(node.relativePath);
      return (
        <div key={node.relativePath} className="tree-node tree-dir">
          <div
            className="tree-row"
            onClick={() => toggle(node.relativePath)}
            role="button"
            tabIndex={0}
          >
            <span className="tree-chevron">{isOpen ? "▾" : "▸"}</span>
            <span>{node.name}</span>
          </div>
          {isOpen && node.children && (
            <div className="tree-children">
              {node.children.map(renderNode).filter(Boolean)}
            </div>
          )}
        </div>
      );
    }
    const isActive = node.relativePath === currentPath;
    const displayName = node.name.replace(/\.md$/, "");
    return (
      <div key={node.relativePath} className="tree-node tree-file">
        <div
          className={`tree-row ${isActive ? "active" : ""}`}
          onClick={() => onSelect(node.relativePath)}
          role="button"
          tabIndex={0}
        >
          <span className="tree-chevron" />
          <span className="tree-file-name">{displayName}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="tree-search">
        <input
          type="text"
          placeholder="filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="tree">{tree.map(renderNode).filter(Boolean)}</div>
    </>
  );
}
