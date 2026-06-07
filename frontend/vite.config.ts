import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // /api/ws must be declared before /api so Vite doesn't treat it as plain HTTP
      "/api/ws": { target: "http://localhost:8000", ws: true },
      "/api": { target: "http://localhost:8000" },
    },
  },
  build: {
    outDir: "../static",
    emptyOutDir: true,
  },
});
