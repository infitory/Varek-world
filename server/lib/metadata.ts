import matter from "gray-matter";

export type EntryMetadata = Record<string, string>;

export interface ParsedEntry {
  /** Raw file contents. */
  raw: string;
  /** H1 title, if present. */
  title: string | null;
  /** File-level metadata extracted from blockquote or YAML frontmatter. */
  metadata: EntryMetadata;
  /** Source of the metadata, for round-tripping on save. */
  metadataSource: "blockquote" | "yaml" | "none";
  /** The body with the top-level title and metadata block stripped. */
  body: string;
}

const TITLE_RE = /^#\s+(.+?)\s*$/m;
// Matches `> **Key:** value` or `> **Key**: value`. Colon can sit inside or
// outside the bold markers.
const BLOCKQUOTE_LINE = /^>\s+\*\*([^*]+?)\*\*\s*(.*)$/;

/**
 * Parse an entry. Supports two metadata conventions:
 *
 * 1. YAML frontmatter at the very top (`---\nkey: value\n---`).
 * 2. A blockquote immediately following the H1 title, where each line has the
 *    form `> **Key:** value`. This is the canonical style used by the Varek
 *    compendium.
 *
 * If both are present, YAML takes precedence.
 */
export function parseEntry(raw: string): ParsedEntry {
  const fm = matter(raw);
  if (Object.keys(fm.data).length > 0) {
    const body = fm.content;
    const titleMatch = body.match(TITLE_RE);
    const title = titleMatch ? titleMatch[1].trim() : null;
    const bodyWithoutTitle = titleMatch
      ? body.replace(titleMatch[0], "").replace(/^\n+/, "")
      : body;
    const metadata: EntryMetadata = {};
    for (const [k, v] of Object.entries(fm.data)) metadata[k] = String(v);
    return {
      raw,
      title,
      metadata,
      metadataSource: "yaml",
      body: bodyWithoutTitle,
    };
  }

  const titleMatch = raw.match(TITLE_RE);
  if (!titleMatch) {
    return { raw, title: null, metadata: {}, metadataSource: "none", body: raw };
  }
  const title = titleMatch[1].trim();
  const afterTitleIdx = (titleMatch.index ?? 0) + titleMatch[0].length;
  const remainder = raw.slice(afterTitleIdx);

  // Skip blank lines, then consume contiguous blockquote lines.
  const lines = remainder.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;

  const metadata: EntryMetadata = {};
  const consumedMetaLines: number[] = [];
  while (i < lines.length && lines[i].startsWith(">")) {
    const m = lines[i].match(BLOCKQUOTE_LINE);
    if (!m) break;
    let key = m[1].trim();
    let value = m[2].trim();
    // The colon can sit inside (`**Key:**`) or outside (`**Key**:`) the
    // bold markers. Require exactly one; otherwise it's not metadata.
    if (key.endsWith(":")) {
      key = key.slice(0, -1).trim();
    } else if (value.startsWith(":")) {
      value = value.slice(1).trim();
    } else {
      break;
    }
    if (!key) break;
    metadata[key] = value;
    consumedMetaLines.push(i);
    i++;
  }

  let body: string;
  let metadataSource: ParsedEntry["metadataSource"];
  if (consumedMetaLines.length > 0) {
    // Skip one trailing blank line after the metadata block, if present.
    if (i < lines.length && lines[i].trim() === "") i++;
    body = lines.slice(i).join("\n");
    metadataSource = "blockquote";
  } else {
    body = remainder.replace(/^\n+/, "");
    metadataSource = "none";
  }

  return { raw, title, metadata, metadataSource, body };
}

/**
 * Build a new file's contents using the blockquote convention. This is what
 * gets written for newly created entries so they match the canonical style.
 */
export function composeBlockquoteEntry(
  title: string,
  metadata: EntryMetadata,
  body: string,
): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  const keys = Object.keys(metadata);
  if (keys.length > 0) {
    for (const key of keys) {
      const value = metadata[key];
      lines.push(`> **${key}:** ${value}`);
    }
    lines.push("");
  }
  lines.push(body.trimStart());
  let out = lines.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  return out;
}
