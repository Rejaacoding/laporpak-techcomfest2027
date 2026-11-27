import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..", "..");

// Muat .env.local lebih dulu (tidak menimpa env production Vercel)
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

// NixOS fallback: gunakan engine debian-openssl-3.0.x via nix-ld saat env belum diset
if (process.platform === "linux" && !process.env.VERCEL && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const candidate = path.join(
    rootDir,
    "node_modules",
    ".prisma",
    "client",
    "libquery_engine-debian-openssl-3.0.x.so.node"
  );
  if (fs.existsSync(candidate)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
  }
}

const { PrismaClient } = await import("@prisma/client");

export const prisma =
  globalThis.__laporpakPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__laporpakPrisma = prisma;
}
