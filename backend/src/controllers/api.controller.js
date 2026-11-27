import {
  aktivasiMitraBodySchema,
  captureNonceBodySchema,
  checkRadiusQuerySchema,
  createTicketBodySchema,
  jurySessionBodySchema,
  jurySimulateTimeBodySchema,
  listTicketsQuerySchema,
  mediaSignedUrlQuerySchema,
  outOfScopeBodySchema,
  raporQuerySchema,
  rateTicketBodySchema,
  rejectSpamBodySchema,
  resolveEscalatedBodySchema,
  resolveTicketBodySchema,
  ticketDetailQuerySchema,
  transferTicketBodySchema,
  validateTicketBodySchema,
} from "../shared/schemas.js";
import crypto from "node:crypto";
import { DEPARTMENTS } from "../shared/constants.js";
import { isHostedProduction, safeEqual } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { AppError, okResponse } from "../lib/errors.js";
import { evaluateActiveTicketsBatch } from "../services/lazy-eval.service.js";
import { cleanupStorageKeys, getSignedNsfwMediaUrl } from "../services/media.service.js";
import {
  checkRadiusPreCamera,
  createTicket,
  getTicketDetail,
  issueCaptureNonce,
  listPublicTickets,
  supportTicket,
  verifyTicketAuditChain,
} from "../services/ticket.service.js";
import { validateTicket } from "../services/validation.service.js";
import { executeDinasAction, listDinasTickets } from "../services/dinas.service.js";
import { getRaporData, rateClosedTicket } from "../services/rapor.service.js";
import {
  createJurySession,
  resetDemoData,
  simulateTicketTimeShift,
} from "../services/jury.service.js";

export async function healthController(_req, res, next) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisStatus = await redis.ping().catch(() => "down");
    return okResponse(
      res,
      {
        status: "healthy",
        service: "LaporPAK! Backend API v3.4",
        db: "up",
        redis: redisStatus,
        region: process.env.VERCEL_REGION || "local",
        timestamp: new Date().toISOString(),
      },
      "Sistem LaporPAK! beroperasi normal."
    );
  } catch (err) {
    return next(err);
  }
}

export async function authMeController(req, res, next) {
  try {
    const user = req.user;
    const isAdminDinas = user.role === "ADMIN_DINAS";
    const staticDept = user.departmentId ? DEPARTMENTS[user.departmentId] : null;

    const [activeTicketCount, dept] = isAdminDinas
      ? [0, staticDept]
      : await Promise.all([
          prisma.ticket.count({
            where: {
              reporterId: user.id,
              status: { notIn: ["CLOSED", "AUTO_CLOSED", "OUT_OF_SCOPE", "REJECTED_SPAM"] },
            },
          }),
          user.departmentId
            ? staticDept ||
              prisma.department.findUnique({
                where: { id: user.departmentId },
                select: { name: true, shortName: true },
              })
            : null,
        ]);

    return okResponse(res, {
      aliasName: user.aliasName,
      role: user.role,
      departmentId: user.departmentId,
      departmentName: dept?.name || null,
      departmentShortName: dept?.shortName || null,
      isVerifiedPartner: user.isVerifiedPartner,
      trustScore: user.trustScore,
      activeTicketCount,
      cooldownUntil: user.cooldownUntil,
      frozenUntil: user.frozenUntil,
      juryMode: req.isJuryMode,
    });
  } catch (err) {
    return next(err);
  }
}

export async function jurySessionController(req, res, next) {
  try {
    const { juryToken } = jurySessionBodySchema.parse(req.body || {});
    const data = createJurySession(juryToken);
    return okResponse(res, data, "Sesi simulasi juri aktif selama 4 jam.");
  } catch (err) {
    return next(err);
  }
}

export async function jurySimulateTimeController(req, res, next) {
  try {
    const { shiftHours } = jurySimulateTimeBodySchema.parse(req.body || {});
    const data = await simulateTicketTimeShift({ ticketId: req.params.id, shiftHours });
    return okResponse(res, data, `Waktu tiket berhasil dipercepat +${shiftHours} jam.`);
  } catch (err) {
    return next(err);
  }
}

export async function juryResetController(_req, res, next) {
  try {
    const data = await resetDemoData();
    return okResponse(res, data, "Data simulasi demo dan skor 4 instansi telah direset bersih.");
  } catch (err) {
    return next(err);
  }
}

export async function listTicketsController(req, res, next) {
  try {
    const query = listTicketsQuerySchema.parse(req.query || {});
    const data = await listPublicTickets(query);
    return okResponse(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function checkRadiusController(req, res, next) {
  try {
    const query = checkRadiusQuerySchema.parse(req.query || {});
    const data = await checkRadiusPreCamera({ ...query, isJuryMode: req.isJuryMode });
    return okResponse(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function getTicketDetailController(req, res, next) {
  try {
    const query = ticketDetailQuerySchema.parse(req.query || {});
    const data = await getTicketDetail({ ticketId: req.params.id, query, user: req.user });
    return okResponse(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function getMediaSignedUrlController(req, res, next) {
  try {
    const { type } = mediaSignedUrlQuerySchema.parse(req.query || {});
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        departmentId: true,
        beforePhotoKey: true,
        afterPhotoKey: true,
        isNsfwPendingReview: true,
      },
    });
    if (!ticket) throw new AppError(404, "NOT_FOUND");
    const targetKey = type === "after" ? ticket.afterPhotoKey : ticket.beforePhotoKey;
    const isQuarantined =
      ticket.status === "REJECTED_SPAM" || String(targetKey || "").startsWith("private/quarantine/");
    if (isQuarantined && req.user?.role !== "ADMIN_DINAS") {
      throw new AppError(403, "FORBIDDEN", "Berkas karantina spam hanya dapat diakses oleh petugas dinas.");
    }
    const data = await getSignedNsfwMediaUrl(ticket, type);
    return okResponse(res, data, "Tautan gambar sementara berlaku 60 detik.");
  } catch (err) {
    return next(err);
  }
}

export async function verifyAuditController(req, res, next) {
  try {
    const data = await verifyTicketAuditChain(req.params.id);
    return okResponse(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function raporController(req, res, next) {
  try {
    const query = raporQuerySchema.parse(req.query || {});
    const data = await getRaporData(query);
    return okResponse(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function rateTicketController(req, res, next) {
  try {
    const body = rateTicketBodySchema.parse(req.body || {});
    const data = await rateClosedTicket({ req, ticketId: req.params.id, body });
    return okResponse(res, data, "Rating kepuasan dan ulasanmu berhasil dicatat.", 201);
  } catch (err) {
    return next(err);
  }
}

export async function captureNonceController(req, res, next) {
  try {
    const body = captureNonceBodySchema.parse(req.body || {});
    const data = issueCaptureNonce({
      user: req.user,
      deviceFingerprint: req.deviceFingerprint,
      actionType: body.actionType,
      ticketId: body.ticketId,
    });
    return okResponse(res, data, "Kupon kamera langsung berhasil diterbitkan.");
  } catch (err) {
    return next(err);
  }
}

export async function createTicketController(req, res, next) {
  try {
    const body = createTicketBodySchema.parse(req.body || {});
    const { ticket, idempotentReplay } = await createTicket({ req, body });
    return okResponse(
      res,
      ticket,
      idempotentReplay
        ? "Laporan sudah tercatat sebelumnya (aman dari duplikasi)."
        : "Laporan berhasil tercatat. Timer tenggat dinas mulai berjalan.",
      idempotentReplay ? 200 : 201
    );
  } catch (err) {
    return next(err);
  }
}

export async function supportTicketController(req, res, next) {
  try {
    const data = await supportTicket({ req, ticketId: req.params.id });
    return okResponse(res, data, "Dukungan prioritasmu berhasil dicatat.");
  } catch (err) {
    return next(err);
  }
}

export async function validateTicketController(req, res, next) {
  try {
    const body = validateTicketBodySchema.parse(req.body || {});
    const data = await validateTicket({ req, ticketId: req.params.id, body });
    return okResponse(
      res,
      data,
      body.type === "CONFIRM_RESOLVED"
        ? "Konfirmasi 'Sudah Beres' berhasil dicatat."
        : "Klaim Palsu dengan bukti lapangan berhasil diajukan."
    );
  } catch (err) {
    return next(err);
  }
}

export async function listDinasTicketsController(req, res, next) {
  try {
    const query = listTicketsQuerySchema.parse(req.query || {});
    const data = await listDinasTickets({ departmentId: req.user.departmentId, query });
    return okResponse(res, data);
  } catch (err) {
    return next(err);
  }
}

const DINAS_ACTION_SCHEMAS = {
  process: null,
  transfer: transferTicketBodySchema,
  "out-of-scope": outOfScopeBodySchema,
  "reject-spam": rejectSpamBodySchema,
  resolve: resolveTicketBodySchema,
  "reprocess-disputed": null,
  "counter-dispute": resolveTicketBodySchema,
  "resolve-escalated": resolveEscalatedBodySchema,
};

export function makeDinasActionController(action) {
  const schema = DINAS_ACTION_SCHEMAS[action];
  return async (req, res, next) => {
    try {
      const body = schema ? schema.parse(req.body || {}) : {};
      const data = await executeDinasAction({ req, ticketId: req.params.id, action, body });
      return okResponse(res, data, `Aksi dinas (${action}) berhasil disimpan.`);
    } catch (err) {
      return next(err);
    }
  };
}

const DEV_PARTNER_INVITE_CODES = {
  "MITRA-DISHUB-2027": "DISHUB",
  "MITRA-PU-2027": "DPU",
  "MITRA-DPU-2027": "DPU",
  "MITRA-DLH-2027": "DLH",
  "MITRA-SATPOLPP-2027": "SATPOLPP",
};

function loadPartnerInviteCodes() {
  const rawJson = process.env.PARTNER_INVITE_CODES_JSON?.trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return {};
    }
  }
  return isHostedProduction() ? {} : DEV_PARTNER_INVITE_CODES;
}

export async function aktivasiMitraController(req, res, next) {
  try {
    const body = aktivasiMitraBodySchema.parse(req.body || {});
    const inviteCodes = loadPartnerInviteCodes();
    if (isHostedProduction() && Object.keys(inviteCodes).length === 0) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Aktivasi mitra mandiri nonaktif di produksi sampai kode resmi server dikonfigurasi."
      );
    }

    const normalizedEmail = body.email.toLowerCase();
    if (isHostedProduction()) {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "Masuk terlebih dahulu sebelum mengaktifkan akun mitra.");
      }
      const callerEmail = String(req.user.email || "").toLowerCase();
      if (req.user.role !== "ADMIN_DINAS" && callerEmail !== normalizedEmail) {
        throw new AppError(403, "FORBIDDEN", "Email aktivasi harus sama dengan akun yang sedang masuk.");
      }
    }

    const code = body.activationCode.toUpperCase();
    const departmentId = Object.prototype.hasOwnProperty.call(inviteCodes, code)
      ? inviteCodes[code]
      : null;
    if (!departmentId || !DEPARTMENTS[departmentId]) {
      throw new AppError(401, "UNAUTHORIZED", "Kode aktivasi mitra tidak sah atau tidak dikenali.");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, role: true, departmentId: true, isVerifiedPartner: true },
    });
    if (
      existingUser &&
      existingUser.role === "ADMIN_DINAS" &&
      existingUser.departmentId &&
      existingUser.departmentId !== departmentId
    ) {
      throw new AppError(409, "VERSION_CONFLICT", "Email ini sudah terdaftar sebagai petugas instansi lain.");
    }

    const codeKey = `mitra:used:${code}`;
    const firstUse = await redis.setNx(codeKey, normalizedEmail, 365 * 24 * 3600);
    if (!firstUse) {
      throw new AppError(409, "VERSION_CONFLICT", "Kode aktivasi mitra sekali pakai ini sudah pernah digunakan.");
    }

    const aliasName = body.aliasName || `Mitra-${departmentId}-${crypto.randomInt(100, 999)}`;
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      create: {
        id: req.user?.id || `mitra_${crypto.randomBytes(8).toString("hex")}`,
        email: normalizedEmail,
        aliasName,
        role: "ADMIN_DINAS",
        departmentId,
        isVerifiedPartner: true,
        isDemoData: false,
        trustScore: 1.0,
      },
      update: {
        role: "ADMIN_DINAS",
        departmentId,
        isVerifiedPartner: true,
      },
    });

    return okResponse(
      res,
      {
        aliasName: user.aliasName,
        role: user.role,
        departmentId: user.departmentId,
        isVerifiedPartner: user.isVerifiedPartner,
      },
      `Akun mitra resmi ${departmentId} berhasil diaktifkan. Kode aktivasi telah dihanguskan.`,
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function cronSlaController(req, res, next) {
  try {
    const authHeader = req.header("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const cronSecret = process.env.CRON_SECRET?.trim();

    if (cronSecret) {
      if (!bearer || !safeEqual(bearer, cronSecret)) {
        throw new AppError(401, "UNAUTHORIZED", "Token autentikasi cron tidak valid.");
      }
    } else if (isHostedProduction()) {
      const serverSecret = process.env.SERVER_SECRET?.trim();
      const hasValidServerBearer = Boolean(serverSecret && bearer && safeEqual(bearer, serverSecret));
      const isVercelCronUa = req.header("user-agent") === "vercel-cron/1.0";
      if (!hasValidServerBearer && !req.isJuryMode && !isVercelCronUa) {
        throw new AppError(401, "UNAUTHORIZED", "Endpoint cron hanya dapat dipicu oleh scheduler resmi.");
      }
      if (isVercelCronUa && !hasValidServerBearer) {
        const acquired = await redis.setNx("cron:sla:prod:lock", "1", 600);
        if (!acquired) {
          return okResponse(
            res,
            { evaluatedAt: new Date().toISOString(), skippedByThrottle: true },
            "Evaluasi SLA baru saja dijalankan."
          );
        }
      }
    }

    await evaluateActiveTicketsBatch({ force: true });

    const expiredQuarantine = await prisma.ticket.findMany({
      where: {
        status: "REJECTED_SPAM",
        quarantineDeleteAt: { lte: new Date() },
      },
      select: { id: true, beforePhotoKey: true },
      take: 50,
    });

    if (expiredQuarantine.length > 0) {
      await cleanupStorageKeys(expiredQuarantine.map((t) => t.beforePhotoKey));
      await prisma.ticket.updateMany({
        where: { id: { in: expiredQuarantine.map((t) => t.id) } },
        data: { quarantineDeleteAt: null, beforePhotoKey: "" },
      });
    }

    return okResponse(
      res,
      {
        evaluatedAt: new Date().toISOString(),
        quarantinePurgedCount: expiredQuarantine.length,
      },
      "Evaluasi SLA terjadwal & pembersihan karantina 7 hari selesai."
    );
  } catch (err) {
    return next(err);
  }
}
