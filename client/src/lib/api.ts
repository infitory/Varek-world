export interface TreeNode {
  name: string;
  relativePath: string;
  kind: "file" | "directory";
  children?: TreeNode[];
}

export interface Entry {
  relativePath: string;
  title: string | null;
  metadata: Record<string, string>;
  metadataSource: "blockquote" | "yaml" | "none";
  body: string;
  raw: string;
  outgoing: Array<{
    label: string;
    href: string;
    targetPath: string;
    anchor: string | null;
    targetRelative: string | null;
  }>;
}

export interface SearchHit {
  relativePath: string;
  title: string | null;
  score: number;
  snippet: string;
}

export interface Edge {
  from: string;
  to: string;
  anchor: string | null;
  label: string;
}

export interface Health {
  ok: boolean;
  model: string;
  hasApiKey: boolean;
  root: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch("/api/health").then((r) => jsonOrThrow<Health>(r)),

  tree: () =>
    fetch("/api/tree").then((r) => jsonOrThrow<{ root: string; tree: TreeNode[] }>(r)),

  entry: (relativePath: string) =>
    fetch(`/api/entries/${encodeEntryPath(relativePath)}`).then((r) =>
      jsonOrThrow<Entry>(r),
    ),

  saveEntry: (relativePath: string, raw: string) =>
    fetch(`/api/entries/${encodeEntryPath(relativePath)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    }).then((r) => jsonOrThrow<{ ok: true; relativePath: string }>(r)),

  createEntry: (input: {
    folder: string;
    filename: string;
    title: string;
    metadata: Record<string, string>;
    body: string;
  }) =>
    fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => jsonOrThrow<{ ok: true; relativePath: string }>(r)),

  links: (relativePath: string) =>
    fetch(`/api/links/${encodeEntryPath(relativePath)}`).then((r) =>
      jsonOrThrow<{ relativePath: string; backlinks: Edge[]; outgoing: Edge[] }>(r),
    ),

  search: (query: string) =>
    fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) =>
      jsonOrThrow<{ query: string; hits: SearchHit[] }>(r),
    ),

  aiExtendStream: (
    relativePath: string,
    instruction: string,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ) => aiStream("/api/ai/extend", { relativePath, instruction }, onChunk, signal),
};

function encodeEntryPath(rel: string): string {
  return rel
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

async function aiStream(
  url: string,
  body: unknown,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (text) onChunk(text);
  }
}
