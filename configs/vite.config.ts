import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { coopPlugin } from "./coopServer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), coopPlugin()],
  base: "/portfolio/",

  resolve: {
    alias: {
      "@": path.resolve("./", "./src"),
    },
  },
  server: {
    port: 3000,
  },
  define: {
    process: {
      env: {},
      cwd: () => "/",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "three-core": ["three"],
          "three-fiber": ["@react-three/fiber"],
          "three-drei": ["@react-three/drei"],
          "three-postprocessing": ["@react-three/postprocessing"],
          postprocessing: ["postprocessing"],
        },
      },
    },
  },
});
