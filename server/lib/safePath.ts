import path from "node:path";

export class PathTraversalError extends Error {
  constructor(offender: string) {
    super(`Path escapes the compendium root: ${offender}`);
    this.name = "PathTraversalError";
  }
}

/**
 * Given the compendium root and a relative path expressed as it appears in the
 * tree (forward slashes, no leading slash), return a normalized absolute path
 * that is guaranteed to sit inside the root. Throws on traversal.
 */
export function resolveInsideRoot(root: string, relative: string): string {
  const normalizedRelative = relative.replace(/^\/+/, "").replace(/\\/g, "/");
  const absolute = path.resolve(root, normalizedRelative);
  const rootAbs = path.resolve(root);
  const rel = path.relative(rootAbs, absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathTraversalError(relative);
  }
  return absolute;
}

export function toRelative(root: string, absolute: string): string {
  return path.relative(path.resolve(root), absolute).split(path.sep).join("/");
}
