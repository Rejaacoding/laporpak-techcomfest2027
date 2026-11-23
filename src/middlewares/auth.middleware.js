import { prisma } from "../lib/prisma.js";
import { generateAliasName, verifyJurySession } from "../lib/crypto.js";
import { hasSupabaseConfig, verifySupabaseJwt } from "../lib/supabase.js";
import { AppError } from "../lib/errors.js";

export const JURY_ROLE_USER_MAP = {
  WARGA_PELAPOR: "demo-warga-pelapor",
  WARGA_VALIDATOR: "demo-warga-validator",
  ADMIN_DISHUB: "demo-admin-dishub",
  ADMIN_DPU: "demo-admin-dpu",
  ADMIN_DLH: "demo-admin-dlh",
  ADMIN_SATPOLPP: "demo-admin-satpolpp",
  ADMIN_SATPOL_PP: "demo-admin-satpolpp",
};

async function findOrProvisionSupabaseUser(sbUser) {
  const existing = await prisma.user.findUnique({ where: { id: sbUser.id } });
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const aliasName = generateAliasName();
    try {
      return await prisma.user.create({
        data: {
          id: sbUser.id,
          email: sbUser.email || `${sbUser.id}@warga.laporpak.id`,
          aliasName,
          role: "WARGA",
          isDemoData: false,
          trustScore: 0.5,
        },
      });
    } catch (err) {
      if (err?.code !== "P2002") throw err;
    }
  }
  throw new AppError(500, "INTERNAL_ERROR");
}

export async function attachAuth(req, _res, next) {
  try {
    req.deviceFingerprint = String(req.header("x-device-fingerprint") || "fp-anonymous").slice(0, 128);
    req.isJuryMode = false;
    req.jurySession = null;
    req.user = null;

    const juryHeader = req.header("x-jury-token");
    if (juryHeader) {
      const parsed = verifyJurySession(juryHeader);
      if (!parsed) {
        return next(new AppError(401, "UNAUTHORIZED", "Sesi simulasi juri tidak valid atau sudah berakhir."));
      }
      req.isJuryMode = true;
      req.jurySession = parsed;

      const requestedRole = String(req.header("x-jury-role") || parsed.roleKey || "WARGA_PELAPOR").toUpperCase();
      const targetUserId = JURY_ROLE_USER_MAP[requestedRole] || JURY_ROLE_USER_MAP.WARGA_PELAPOR;
      const demoUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (demoUser) {
        req.user = demoUser;
        return next();
      }
    }

    const authHeader = req.header("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const sbUser = await verifySupabaseJwt(token);
      if (sbUser?.id) {
        req.user = await findOrProvisionSupabaseUser(sbUser);
        return next();
      }
    }

    // shortcut: header X-Dev-User-Id diblokir mutlak di production, di Vercel (Prod/Preview), dan saat SUPABASE_URL aktif (kecuali NODE_ENV=test lokal).
    if (
      process.env.NODE_ENV !== "production" &&
      !process.env.VERCEL &&
      (process.env.NODE_ENV === "test" || !hasSupabaseConfig())
    ) {
      const devUserId = req.header("x-dev-user-id");
      if (devUserId) {
        const devUser = await prisma.user.findUnique({ where: { id: devUserId } });
        if (devUser) {
          req.user = devUser;
          return next();
        }
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new AppError(401, "UNAUTHORIZED"));
  }
  return next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, "UNAUTHORIZED"));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN"));
    }
    return next();
  };
}

export function requireJuryToken(req, _res, next) {
  if (!req.isJuryMode || !req.jurySession) {
    return next(new AppError(403, "FORBIDDEN", "Endpoint ini hanya dapat diakses melalui sesi simulasi juri."));
  }
  return next();
}
