import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveInsideRoot } from "../lib/safePath.js";
import { parseEntry, composeBlockquoteEntry } from "../lib/metadata.js";
import { extractLinks } from "../lib/links.js";
import type { SearchIndex } from "../lib/search.js";
import type { LinkGraph } from "../lib/backlinks.js";

interface Deps {
  root: string;
  search: SearchIndex;
  links: LinkGraph;
}

const FILENAME_RE = /^[a-z0-9][a-z0-9-]*\.md$/;
const DIR_SEGMENT_RE = /^[a-z0-9][a-z0-9-]*$/;

export function entriesRouter({ root, search, links }: Deps): Router {
  const r = Router();

  // Read an entry
  r.get("/entries/*", async (req, res) => {
    const rel = decodeURIComponent((req.params as any)[0] ?? "");
    if (!rel.endsWith(".md")) {
      return res.status(400).json({ error: "Only markdown entries are supported." });
    }
    try {
      const abs = resolveInsideRoot(root, rel);
      const raw = await fs.readFile(abs, "utf-8");
      const parsed = parseEntry(raw);
      const outgoing = extractLinks(parsed.body, rel).filter(
        (l) => l.targetRelative && l.targetRelative !== rel,
      );
      res.json({
        relativePath: rel,
        title: parsed.title,
        metadata: parsed.metadata,
        metadataSource: parsed.metadataSource,
        body: parsed.body,
        raw,
        outgoing,
      });
    } catch (err: any) {
      if (err.code === "ENOENT") return res.status(404).json({ error: "Not found" });
      res.status(400).json({ error: err.message });
    }
  });

  // Write (update) an entry
  r.put("/entries/*", async (req, res) => {
    const rel = decodeURIComponent((req.params as any)[0] ?? "");
    const { raw } = req.body ?? {};
    if (typeof raw !== "string") {
      return res.status(400).json({ error: "Missing 'raw' field." });
    }
    try {
      const abs = resolveInsideRoot(root, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, ensureTrailingNewline(raw), "utf-8");
      await Promise.all([search.indexFile(rel), links.indexFile(rel)]);
      res.json({ ok: true, relativePath: rel });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Create a new entry
  r.post("/entries", async (req, res) => {
    const { folder, filename, title, metadata, body } = req.body ?? {};
    if (typeof folder !== "string" || typeof filename !== "string") {
      return res.status(400).json({ error: "folder and filename are required." });
    }
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "title is required." });
    }
    const folderSegments = folder.split("/").filter(Boolean);
    for (const seg of folderSegments) {
      if (!DIR_SEGMENT_RE.test(seg)) {
        return res.status(400).json({
          error: `Invalid folder segment '${seg}'. Use lowercase letters, numbers, and dashes.`,
        });
      }
    }
    if (!FILENAME_RE.test(filename)) {
      return res.status(400).json({
        error: "Filename must be lowercase kebab-case ending in .md (e.g. 'new-kingdom.md').",
      });
    }
    const rel = [...folderSegments, filename].join("/");
    try {
      const abs = resolveInsideRoot(root, rel);
      try {
        await fs.access(abs);
        return res.status(409).json({ error: "A file already exists at that path." });
      } catch {
        // good, doesn't exist
      }
      await fs.mkdir(path.dirname(abs), { recursive: true });
      const content = composeBlockquoteEntry(title.trim(), metadata ?? {}, body ?? "");
      await fs.writeFile(abs, content, "utf-8");
      await Promise.all([search.indexFile(rel), links.indexFile(rel)]);
      res.status(201).json({ ok: true, relativePath: rel });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Backlinks + outgoing (from the live graph, not just the current body)
  r.get("/links/*", async (req, res) => {
    const rel = decodeURIComponent((req.params as any)[0] ?? "");
    res.json({
      relativePath: rel,
      backlinks: links.backlinks(rel),
      outgoing: links.outgoing(rel),
    });
  });

  return r;
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}
