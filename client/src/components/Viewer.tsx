import { useEffect, useMemo, useRef } from "react";
import type { Entry } from "../lib/api";
import { renderMarkdown, slugify } from "../lib/markdown";
import { MetadataBlock } from "./MetadataBlock";
import { SafeHtml } from "./SafeHtml";

interface Props {
  entry: Entry;
  targetAnchor: string | null;
  onInternalLink: (path: string, anchor: string | null) => void;
}

export function Viewer({ entry, targetAnchor, onInternalLink }: Props) {
  const html = useMemo(
    () => renderMarkdown(entry.body, entry.relativePath),
    [entry.body, entry.relativePath],
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (targetAnchor) {
      const anchorEl = el.querySelector(`[id="${CSS.escape(slugify(targetAnchor))}"]`);
      if (anchorEl) {
        anchorEl.scrollIntoView({ behavior: "instant", block: "start" });
        return;
      }
    }
    el.scrollTo({ top: 0 });
  }, [targetAnchor, entry.relativePath]);

  return (
    <div ref={wrapRef} className="view-wrap">
      <article className="view">
        <h1>{entry.title ?? entry.relativePath}</h1>
        <MetadataBlock
          relativePath={entry.relativePath}
          metadata={entry.metadata}
          onInternalLink={onInternalLink}
        />
        <SafeHtml html={html} onInternalLink={onInternalLink} />
      </article>
    </div>
  );
}
