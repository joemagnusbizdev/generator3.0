import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "./src1",
  envDir: "..",  // Load .env from project root (parent of src1)
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src1"),
      "@styles": path.resolve(__dirname, "./src1/styles"),
      "@lib": path.resolve(__dirname, "./src1/lib"),
      "@components": path.resolve(__dirname, "./src1/components"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
