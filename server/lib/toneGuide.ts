import fs from "node:fs/promises";
import path from "node:path";

/**
 * Pull the "Tone guide" section out of the compendium README. If the section
 * is missing, fall back to the whole README so the AI still gets context.
 */
export async function loadToneGuide(root: string): Promise<string> {
  const readmePath = path.join(root, "README.md");
  let raw: string;
  try {
    raw = await fs.readFile(readmePath, "utf-8");
  } catch {
    return "";
  }

  const headingRe = /^##\s+Tone guide\s*$/im;
  const match = raw.match(headingRe);
  if (!match) return raw;
  const start = match.index ?? 0;
  const afterHeading = raw.slice(start);
  const nextHeading = afterHeading.slice(match[0].length).search(/^##\s+/m);
  const section =
    nextHeading === -1
      ? afterHeading
      : afterHeading.slice(0, match[0].length + nextHeading);
  return section.trim();
}
