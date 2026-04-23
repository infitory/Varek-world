const KEY = "varek-theme";
export type Theme = "dark" | "light";

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  document.documentElement.dataset.theme = theme;
}

export function toggleTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

export function categoryFromPath(relativePath: string): string {
  const top = relativePath.split("/")[0] ?? "";
  switch (top) {
    case "characters":
      return "character";
    case "kingdoms":
      return "kingdom";
    case "faiths":
      return "faith";
    case "history":
      return "history";
    case "margins":
      return "margin";
    case "world":
      return "world";
    case "story":
      return "story";
    default:
      return "default";
  }
}
