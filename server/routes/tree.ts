import { Router } from "express";
import { buildTree } from "../lib/tree.js";

export function treeRouter(root: string): Router {
  const r = Router();
  r.get("/tree", async (_req, res) => {
    try {
      const tree = await buildTree(root);
      res.json({ root: "varek", tree });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  return r;
}
