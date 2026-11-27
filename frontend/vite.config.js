import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Muat .env dari root monorepo (satu tingkat di atas folder frontend)
  const rootEnv = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const supabaseUrl =
    rootEnv.VITE_SUPABASE_URL ||
    rootEnv.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const supabaseAnonKey =
    rootEnv.VITE_SUPABASE_ANON_KEY ||
    rootEnv.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl.trim()),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey.trim()),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("/leaflet/")) return "vendor-leaflet";
            if (id.includes("/@supabase/")) return "vendor-supabase";
            if (id.includes("/lucide-react/")) return "vendor-icons";
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-router") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:5050",
          changeOrigin: true,
        },
        "/samples": {
          target: "http://localhost:5050",
          changeOrigin: true,
        },
        "/geo": {
          target: "http://localhost:5050",
          changeOrigin: true,
        },
      },
    },
  };
});
