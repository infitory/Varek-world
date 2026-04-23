import { Router } from "express";
import type { SearchIndex } from "../lib/search.js";

export function searchRouter(index: SearchIndex): Router {
  const r = Router();
  r.get("/search", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 25;
    const hits = index.search(q, limit);
    res.json({ query: q, hits });
  });
  return r;
}
