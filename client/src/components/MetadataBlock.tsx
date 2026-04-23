import { categoryFromPath } from "../lib/theme";
import { renderMarkdown } from "../lib/markdown";
import { SafeHtml } from "./SafeHtml";

interface Props {
  relativePath: string;
  metadata: Record<string, string>;
  onInternalLink: (path: string, anchor: string | null) => void;
}

export function MetadataBlock({ relativePath, metadata, onInternalLink }: Props) {
  const keys = Object.keys(metadata);
  const category = categoryFromPath(relativePath);

  const typeValue = metadata.Type ?? metadata.type ?? null;
  const tagLabel = typeValue ? typeValue.split(/[(,]/)[0].trim() : null;

  if (keys.length === 0 && !tagLabel) {
    return null;
  }

  return (
    <div className="meta">
      {tagLabel && (
        <>
          <div className="meta-key">Kind</div>
          <div className="meta-value">
            <span className={`tag tag-${category}`}>{tagLabel}</span>
          </div>
        </>
      )}
      {keys
        .filter((k) => k.toLowerCase() !== "type")
        .map((k) => (
          <div key={k} style={{ display: "contents" }}>
            <div className="meta-key">{k}</div>
            <div className="meta-value">
              <SafeHtml
                html={renderInlineMarkdown(metadata[k], relativePath)}
                onInternalLink={onInternalLink}
              />
            </div>
          </div>
        ))}
    </div>
  );
}

// Render as a single paragraph so links work but no wrapping <p> spacing.
function renderInlineMarkdown(text: string, sourceRelative: string): string {
  const raw = renderMarkdown(text, sourceRelative);
  return raw.replace(/^<p>/, "").replace(/<\/p>\s*$/, "");
}
