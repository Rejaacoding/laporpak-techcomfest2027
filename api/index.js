import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { attachAuth } from "../src/middlewares/auth.middleware.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import { AppError } from "../src/lib/errors.js";
import { hasSupabaseConfig } from "../src/lib/supabase.js";
import apiRoutes from "../src/routes/api.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicPath = path.join(rootDir, "public");

function buildAllowedOrigins() {
  const list = new Set();
  for (const raw of (process.env.ALLOWED_ORIGINS || "").split(",")) {
    const trimmed = raw.trim();
    if (trimmed) list.add(trimmed);
  }
  if (process.env.FRONTEND_URL) list.add(process.env.FRONTEND_URL.trim());
  if (process.env.VERCEL_URL) list.add(`https://${process.env.VERCEL_URL.trim()}`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    list.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`);
  }
  return list;
}

const app = express();
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = buildAllowedOrigins();
      if (allowed.has(origin)) return callback(null, true);
      const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (!process.env.VERCEL && process.env.NODE_ENV !== "production" && isLocalOrigin) {
        return callback(null, true);
      }
      return callback(new AppError(403, "FORBIDDEN", "Origin tidak diizinkan mengakses API LaporPAK!"));
    },
  })
);
app.use(express.json({ limit: "8mb" }));
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(express.static(publicPath));
if (process.env.NODE_ENV !== "production" && !hasSupabaseConfig()) {
  app.use("/local-media", express.static(path.join(rootDir, ".local-media")));
}

app.use("/api", attachAuth, apiRoutes);

app.use("/api/*", (_req, res) => {
  res.status(404).json({
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: "Endpoint API tidak ditemukan.",
      retryable: false,
    },
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.use(errorHandler);

const PORT = process.env.PORT || 5050;
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`LaporPAK! API v3.4 running on http://localhost:${PORT}`);
  });
}

export default app;
