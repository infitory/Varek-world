import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const API_PORT = process.env.VAREK_API_PORT ?? "5174";
const WEB_PORT = Number(process.env.VAREK_WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "client"),
  server: {
    port: WEB_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/client"),
    emptyOutDir: true,
  },
});
