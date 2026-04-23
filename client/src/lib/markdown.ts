import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: true,
  breaks: false,
}).use(anchor, { permalink: false, slugify: (s: string) => slugify(s) });

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const ABSOLUTE_RE = /^(?:https?:|mailto:|tel:|ftp:|\/\/)/i;

/**
 * Render markdown to HTML, attaching attributes to links so the React layer
 * can intercept clicks. Compendium-internal links are marked with
 * `data-internal-path` and external links get `target="_blank"`.
 */
export function renderMarkdown(
  body: string,
  sourceRelative: string | null,
): string {
  const tokens = md.parse(body, {});
  for (const token of tokens) {
    if (token.type === "inline" && token.children) {
      for (const child of token.children) {
        if (child.type === "link_open") {
          const hrefIdx = child.attrIndex("href");
          if (hrefIdx < 0) continue;
          const href = child.attrs![hrefIdx][1];
          if (ABSOLUTE_RE.test(href)) {
            child.attrJoin("target", "_blank");
            child.attrJoin("rel", "noopener noreferrer");
            child.attrJoin("class", "external");
            continue;
          }
          const resolved = resolveInternalHref(href, sourceRelative);
          if (resolved) {
            child.attrSet("data-internal-path", resolved.path);
            if (resolved.anchor) child.attrSet("data-anchor", resolved.anchor);
            // Keep href for copy/inspect, but we'll preventDefault on click.
            child.attrSet("href", buildClientHref(resolved.path, resolved.anchor));
          }
        }
      }
    }
  }
  return md.renderer.render(tokens, md.options, {});
}

function resolveInternalHref(
  href: string,
  sourceRelative: string | null,
): { path: string; anchor: string | null } | null {
  const [pathPart, anchorPart] = href.split("#", 2);
  const anchor = anchorPart ?? null;
  if (pathPart === "") {
    // Same-file anchor link
    if (!sourceRelative) return null;
    return { path: sourceRelative, anchor };
  }
  if (!pathPart) return null;
  if (!sourceRelative) return null;

  const sourceDir = sourceRelative.includes("/")
    ? sourceRelative.slice(0, sourceRelative.lastIndexOf("/"))
    : "";
  const joined = posixJoin(sourceDir, pathPart);
  const normalized = posixNormalize(joined);
  if (normalized.startsWith("..")) return null;
  return { path: normalized, anchor };
}

function buildClientHref(path: string, anchor: string | null): string {
  const a = anchor ? `#${anchor}` : "";
  return `/entry/${path}${a}`;
}

function posixJoin(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a}/${b}`;
}

function posixNormalize(p: string): string {
  const parts = p.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length === 0 || stack[stack.length - 1] === "..") stack.push("..");
      else stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join("/");
}
