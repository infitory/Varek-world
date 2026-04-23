import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "../lib/api";
import { api } from "../lib/api";

interface Props {
  onSelect: (relativePath: string) => void;
  onClose: () => void;
}

export function GlobalSearch({ onSelect, onClose }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [focus, setFocus] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setHits([]);
      setFocus(0);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .search(query)
        .then((res) => {
          if (!cancelled) {
            setHits(res.hits);
            setFocus(0);
          }
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocus((f) => Math.min(hits.length - 1, f + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocus((f) => Math.max(0, f - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[focus];
      if (hit) onSelect(hit.relativePath);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search the compendium…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {q.trim() && hits.length === 0 && (
          <div className="search-empty">No matches.</div>
        )}
        <ul className="search-results">
          {hits.map((hit, idx) => (
            <li
              key={hit.relativePath}
              className={`search-hit ${idx === focus ? "focus" : ""}`}
              onMouseEnter={() => setFocus(idx)}
              onClick={() => onSelect(hit.relativePath)}
            >
              <div>
                <span className="search-hit-title">
                  {hit.title ?? hit.relativePath}
                </span>
                <span className="search-hit-path">{hit.relativePath}</span>
              </div>
              <div className="search-hit-snippet">{hit.snippet}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
