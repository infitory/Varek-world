import express from "express";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { SearchIndex } from "./lib/search.js";
import { LinkGraph } from "./lib/backlinks.js";
import { treeRouter } from "./routes/tree.js";
import { entriesRouter } from "./routes/entries.js";
import { searchRouter } from "./routes/search.js";
import { aiRouter } from "./routes/ai.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const compendiumRoot = path.resolve(
  process.env.VAREK_ROOT
    ? path.isAbsolute(process.env.VAREK_ROOT)
      ? process.env.VAREK_ROOT
      : path.join(repoRoot, process.env.VAREK_ROOT)
    : path.join(repoRoot, "varek"),
);

if (!fs.existsSync(compendiumRoot)) {
  console.error(
    `[varek] Compendium directory not found at ${compendiumRoot}. Set VAREK_ROOT or place the compendium at ./varek.`,
  );
  process.exit(1);
}

const MODEL = process.env.VAREK_MODEL || "claude-opus-4-7";
const PORT = Number(process.env.VAREK_API_PORT ?? 5174);

async function main() {
  const search = new SearchIndex(compendiumRoot);
  const links = new LinkGraph(compendiumRoot);

  console.log(`[varek] indexing compendium at ${compendiumRoot} …`);
  await Promise.all([search.build(), links.build()]);
  search.watch();
  links.watch();
  console.log(`[varek] index ready`);

  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.use("/api", treeRouter(compendiumRoot));
  app.use("/api", entriesRouter({ root: compendiumRoot, search, links }));
  app.use("/api", searchRouter(search));
  app.use("/api", aiRouter({ root: compendiumRoot, links, model: MODEL }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      model: MODEL,
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
      root: path.basename(compendiumRoot),
    });
  });

  if (process.env.NODE_ENV === "production") {
    const clientDist = path.resolve(repoRoot, "dist/client");
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(clientDist, "index.html"));
      });
    }
  }

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`[varek] api listening on http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[varek] dev frontend:    http://localhost:${process.env.VAREK_WEB_PORT ?? 5173}`);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
