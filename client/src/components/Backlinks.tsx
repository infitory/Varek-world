import { useEffect, useState } from "react";
import type { Edge } from "../lib/api";
import { api } from "../lib/api";

interface Props {
  relativePath: string;
  onOpen: (relativePath: string, anchor: string | null) => void;
  /** refreshKey bumps after save so backlinks re-fetch. */
  refreshKey?: number;
}

interface LinkData {
  backlinks: Edge[];
  outgoing: Edge[];
}

export function Backlinks({ relativePath, onOpen, refreshKey }: Props) {
  const [data, setData] = useState<LinkData | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .links(relativePath)
      .then((d) => {
        if (!cancelled) setData({ backlinks: d.backlinks, outgoing: d.outgoing });
      })
      .catch(() => {
        if (!cancelled) setData({ backlinks: [], outgoing: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [relativePath, refreshKey]);

  if (!data) return null;

  const incoming = groupBy(data.backlinks, (e) => e.from);
  const outgoing = groupBy(data.outgoing, (e) => e.to);

  return (
    <>
      <div className="side-section">
        <h3 className="side-title">Backlinks</h3>
        {incoming.length === 0 ? (
          <div className="side-empty">No entries link here.</div>
        ) : (
          <ul className="side-list">
            {incoming.map(([path, edges]) => (
              <li key={path}>
                <span className="label" onClick={() => onOpen(path, null)}>
                  {displayName(path)}
                </span>
                <span className="path">
                  {path}
                  {edges.length > 1 ? ` · ${edges.length}×` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="side-section">
        <h3 className="side-title">References out</h3>
        {outgoing.length === 0 ? (
          <div className="side-empty">No outgoing links.</div>
        ) : (
          <ul className="side-list">
            {outgoing.map(([path, edges]) => {
              const firstAnchor = edges[0]?.anchor ?? null;
              return (
                <li key={path}>
                  <span className="label" onClick={() => onOpen(path, firstAnchor)}>
                    {displayName(path)}
                  </span>
                  <span className="path">
                    {path}
                    {edges.length > 1 ? ` · ${edges.length}×` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function displayName(relativePath: string): string {
  const last = relativePath.split("/").pop() ?? relativePath;
  return last.replace(/\.md$/, "");
}
