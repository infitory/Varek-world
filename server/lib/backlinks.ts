import fs from "node:fs/promises";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { listAllMarkdownFiles } from "./tree.js";
import { extractLinks, type MarkdownLink } from "./links.js";

interface EdgeEntry {
  /** Source entry (compendium-relative path). */
  from: string;
  /** Resolved target path (compendium-relative), without anchor. */
  to: string;
  /** Anchor on the target, if any. */
  anchor: string | null;
  /** The link label as it appears in the source. */
  label: string;
}

export class LinkGraph {
  private root: string;
  /** forward[from] = links going out from this file */
  private forward = new Map<string, EdgeEntry[]>();
  /** backward[to] = links coming into this file */
  private backward = new Map<string, EdgeEntry[]>();
  private watcher: FSWatcher | null = null;

  constructor(root: string) {
    this.root = root;
  }

  async build(): Promise<void> {
    const files = await listAllMarkdownFiles(this.root);
    await Promise.all(files.map((f) => this.indexFile(f)));
  }

  watch(): void {
    if (this.watcher) return;
    this.watcher = chokidar.watch("**/*.md", {
      cwd: this.root,
      ignoreInitial: true,
      ignored: ["**/node_modules/**", "**/.git/**"],
    });
    this.watcher.on("add", (rel: string) => this.indexFile(rel).catch(() => {}));
    this.watcher.on("change", (rel: string) => this.indexFile(rel).catch(() => {}));
    this.watcher.on("unlink", (rel: string) => this.remove(normalize(rel)));
  }

  async indexFile(relativePath: string): Promise<void> {
    const rel = normalize(relativePath);
    this.remove(rel);
    const abs = path.join(this.root, rel);
    try {
      const raw = await fs.readFile(abs, "utf-8");
      const links = extractLinks(raw, rel);
      const edges: EdgeEntry[] = [];
      for (const link of links) {
        if (!link.targetRelative) continue;
        if (link.targetRelative === rel && !link.anchor) continue;
        const edge: EdgeEntry = {
          from: rel,
          to: link.targetRelative,
          anchor: link.anchor,
          label: link.label,
        };
        edges.push(edge);
        if (!this.backward.has(edge.to)) this.backward.set(edge.to, []);
        this.backward.get(edge.to)!.push(edge);
      }
      this.forward.set(rel, edges);
    } catch {
      this.forward.delete(rel);
    }
  }

  private remove(rel: string) {
    const existing = this.forward.get(rel) ?? [];
    for (const edge of existing) {
      const list = this.backward.get(edge.to);
      if (!list) continue;
      const filtered = list.filter((e) => e.from !== rel);
      if (filtered.length === 0) this.backward.delete(edge.to);
      else this.backward.set(edge.to, filtered);
    }
    this.forward.delete(rel);
  }

  outgoing(rel: string): EdgeEntry[] {
    return this.forward.get(normalize(rel)) ?? [];
  }

  backlinks(rel: string): EdgeEntry[] {
    return this.backward.get(normalize(rel)) ?? [];
  }

  async close(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }
}

function normalize(rel: string): string {
  return rel.replace(/\\/g, "/");
}

export type { MarkdownLink };
