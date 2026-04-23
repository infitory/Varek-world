import fs from "node:fs/promises";
import path from "node:path";

export interface TreeNode {
  name: string;
  relativePath: string;
  kind: "file" | "directory";
  children?: TreeNode[];
}

const IGNORED_NAMES = new Set([".git", "node_modules", ".DS_Store", ".vite"]);

export async function buildTree(root: string, rel = ""): Promise<TreeNode[]> {
  const absoluteDir = path.join(root, rel);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const nodes: TreeNode[] = [];
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;
    const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        relativePath: entryRel,
        kind: "directory",
        children: await buildTree(root, entryRel),
      });
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      nodes.push({
        name: entry.name,
        relativePath: entryRel,
        kind: "file",
      });
    }
  }
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

export async function listAllMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(rel: string) {
    const dir = path.join(root, rel);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(entryRel);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(entryRel);
      }
    }
  }
  await walk("");
  return out;
}
