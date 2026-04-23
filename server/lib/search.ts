import fs from "node:fs/promises";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { listAllMarkdownFiles } from "./tree.js";
import { parseEntry } from "./metadata.js";

interface IndexedDoc {
  relativePath: string;
  title: string | null;
  metadata: Record<string, string>;
  body: string;
  lower: string;
  tokens: Set<string>;
}

export interface SearchHit {
  relativePath: string;
  title: string | null;
  score: number;
  snippet: string;
}

const TOKEN_RE = /[a-z0-9']+/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

function makeSnippet(body: string, query: string): string {
  const lower = body.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return body.slice(0, 160);
  const idx = lower.indexOf(q);
  if (idx < 0) {
    const tokens = tokenize(q);
    for (const t of tokens) {
      const i = lower.indexOf(t);
      if (i >= 0) return excerpt(body, i, t.length);
    }
    return body.slice(0, 160);
  }
  return excerpt(body, idx, q.length);
}

function excerpt(body: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + len + 120);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  return (prefix + body.slice(start, end) + suffix).replace(/\s+/g, " ").trim();
}

export class SearchIndex {
  private root: string;
  private docs = new Map<string, IndexedDoc>();
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
    this.watcher.on("unlink", (rel: string) => {
      this.docs.delete(normalize(rel));
    });
  }

  async indexFile(relativePath: string): Promise<void> {
    const rel = normalize(relativePath);
    const abs = path.join(this.root, rel);
    try {
      const raw = await fs.readFile(abs, "utf-8");
      const parsed = parseEntry(raw);
      const searchBody = [
        parsed.title ?? "",
        Object.values(parsed.metadata).join(" "),
        parsed.body,
        rel,
      ].join("\n");
      const tokens = new Set(tokenize(searchBody));
      this.docs.set(rel, {
        relativePath: rel,
        title: parsed.title,
        metadata: parsed.metadata,
        body: parsed.body,
        lower: searchBody.toLowerCase(),
        tokens,
      });
    } catch {
      this.docs.delete(rel);
    }
  }

  search(query: string, limit = 25): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const qLower = trimmed.toLowerCase();
    const qTokens = tokenize(trimmed);
    const hits: SearchHit[] = [];
    for (const doc of this.docs.values()) {
      let score = 0;
      if (doc.lower.includes(qLower)) score += 10;
      for (const t of qTokens) {
        if (doc.tokens.has(t)) score += 2;
      }
      if (doc.title && doc.title.toLowerCase().includes(qLower)) score += 15;
      if (doc.relativePath.toLowerCase().includes(qLower)) score += 5;
      if (score > 0) {
        hits.push({
          relativePath: doc.relativePath,
          title: doc.title,
          score,
          snippet: makeSnippet(doc.body, trimmed),
        });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  async close(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }
}

function normalize(rel: string): string {
  return rel.replace(/\\/g, "/");
}
