import { Router } from "express";
import fs from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { resolveInsideRoot } from "../lib/safePath.js";
import { parseEntry } from "../lib/metadata.js";
import { extractLinks } from "../lib/links.js";
import { loadToneGuide } from "../lib/toneGuide.js";
import type { LinkGraph } from "../lib/backlinks.js";

interface Deps {
  root: string;
  links: LinkGraph;
  model: string;
}

const SYSTEM_PREAMBLE = `You are a writer helping maintain and extend the worldbuilding compendium for Varek, a low dark fantasy setting.

You MUST preserve the voice of the existing compendium. The tone guide below is canonical. Obey it exactly:

---
{TONE_GUIDE}
---

Style rules that follow from the tone guide:
- Dry, slightly tired scholarly register. Short sentences. Facts first.
- No heroes, no prophecies, no chosen ones, no final victories.
- Magic is rare, costly, mostly broken, and usually bad for the user.
- Institutions rot from the inside while pretending to function.
- Faith is ambiguous; gods may or may not be real.
- Death is ordinary.
- Never introduce a happy ending, a clean victory, or a decisive revelation unless the user explicitly asks.
- Cross-reference existing entries with relative markdown links where it fits naturally. Do not invent linked files.
- Match the existing format: markdown with H2/H3 headers and occasional bulleted lists, not prose walls.
- If you are extending an existing entry, produce only the new material — do NOT repeat what is already written.`;

export function aiRouter({ root, links, model }: Deps): Router {
  const r = Router();

  r.post("/ai/extend", async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error:
          "ANTHROPIC_API_KEY is not set. Create a .env file at the repo root with ANTHROPIC_API_KEY=...",
      });
    }

    const { relativePath, instruction } = req.body ?? {};
    if (typeof relativePath !== "string") {
      return res.status(400).json({ error: "relativePath is required." });
    }

    let abs: string;
    try {
      abs = resolveInsideRoot(root, relativePath);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    let raw: string;
    try {
      raw = await fs.readFile(abs, "utf-8");
    } catch {
      return res.status(404).json({ error: "Entry not found." });
    }

    const parsed = parseEntry(raw);
    const toneGuide = await loadToneGuide(root);
    const systemPrompt = SYSTEM_PREAMBLE.replace(
      "{TONE_GUIDE}",
      toneGuide || "(tone guide not found — default to dry, quiet, low dark fantasy)",
    );

    // Pull direct outgoing links from the live graph so we can load linked
    // entries as context (the fresh body on disk).
    const outgoing = links.outgoing(relativePath);
    const uniqueTargets = Array.from(
      new Set(
        outgoing
          .map((e) => e.to)
          .filter((to) => to && to !== relativePath && to.endsWith(".md")),
      ),
    ).slice(0, 8); // cap context

    const contextEntries: { path: string; body: string }[] = [];
    for (const target of uniqueTargets) {
      try {
        const linkedAbs = resolveInsideRoot(root, target);
        const linkedRaw = await fs.readFile(linkedAbs, "utf-8");
        const linkedParsed = parseEntry(linkedRaw);
        // Trim to keep the context tight
        const bodySnippet = linkedParsed.body.slice(0, 3000);
        contextEntries.push({ path: target, body: bodySnippet });
      } catch {
        // Missing linked file is fine — skip it.
      }
    }

    const linkedContextBlock =
      contextEntries.length === 0
        ? "(no directly linked entries were loaded)"
        : contextEntries
            .map(
              (e) =>
                `<entry path="${e.path}">\n${e.body.trim()}\n</entry>`,
            )
            .join("\n\n");

    const userInstruction =
      typeof instruction === "string" && instruction.trim()
        ? instruction.trim()
        : "Extend this entry with one new section that fits the compendium's tone and structure. Add only the new material.";

    const userMessage = `I am editing this entry:

<current-entry path="${relativePath}" title="${parsed.title ?? ""}">
${raw.trim()}
</current-entry>

These entries are linked from the current one and may be useful context:

${linkedContextBlock}

Task: ${userInstruction}

Return only the new markdown to append — no preamble, no commentary, no repetition of existing text.`;

    const anthropic = new Anthropic({ apiKey });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      stream.on("text", (delta) => {
        res.write(delta);
      });

      await stream.finalMessage();
      res.end();
    } catch (err: any) {
      const msg = err?.message ?? "AI request failed";
      if (!res.headersSent) {
        res.status(500).json({ error: msg });
      } else {
        res.write(`\n\n[error] ${msg}\n`);
        res.end();
      }
    }
  });

  return r;
}
