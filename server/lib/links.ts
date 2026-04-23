import path from "node:path";

export interface MarkdownLink {
  label: string;
  /** Full href as it appears in the source. */
  href: string;
  /** Path portion, with anchor removed. */
  targetPath: string;
  /** Anchor, without the leading `#`. */
  anchor: string | null;
  /**
   * If the link points to a file inside the compendium, this is the relative
   * path from the root (e.g. `characters/aldric.md`). Null if the link is
   * external, mailto:, or points outside the root.
   */
  targetRelative: string | null;
}

const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const ABSOLUTE_RE = /^(?:https?:|mailto:|tel:|ftp:|\/\/)/i;

/**
 * Extract markdown links from a body of text. `sourceRelative` is the path of
 * the entry the text belongs to, expressed relative to the compendium root
 * (e.g. `characters/aldric.md`). It is used to resolve relative links like
 * `../kingdoms/ostmere.md` back to a compendium-relative path.
 */
export function extractLinks(body: string, sourceRelative: string): MarkdownLink[] {
  const out: MarkdownLink[] = [];
  const sourceDir = path.posix.dirname(sourceRelative);
  let match: RegExpExecArray | null;
  MD_LINK_RE.lastIndex = 0;
  while ((match = MD_LINK_RE.exec(body)) !== null) {
    const label = match[1];
    const href = match[2].trim();
    if (!href) continue;
    if (ABSOLUTE_RE.test(href)) {
      out.push({ label, href, targetPath: href, anchor: null, targetRelative: null });
      continue;
    }
    const [pathPart, anchorPart] = href.split("#", 2);
    const anchor = anchorPart ?? null;
    let targetRelative: string | null = null;
    if (pathPart === "") {
      // Same-document anchor link.
      targetRelative = sourceRelative;
    } else {
      const joined = path.posix.normalize(path.posix.join(sourceDir, pathPart));
      if (joined.startsWith("..")) {
        targetRelative = null;
      } else {
        targetRelative = joined;
      }
    }
    out.push({ label, href, targetPath: pathPart, anchor, targetRelative });
  }
  return out;
}
