import { useEffect, useRef } from "react";

interface Props {
  html: string;
  onInternalLink: (path: string, anchor: string | null) => void;
  className?: string;
}

/**
 * Renders pre-rendered markdown HTML and intercepts clicks on internal links
 * (those with data-internal-path) so the app can navigate in-place instead of
 * following the href to a 404.
 */
export function SafeHtml({ html, onInternalLink, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      const internal = anchor.getAttribute("data-internal-path");
      if (!internal) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const anchorHash = anchor.getAttribute("data-anchor");
      onInternalLink(internal, anchorHash);
    }
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [onInternalLink]);

  return (
    <div
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
