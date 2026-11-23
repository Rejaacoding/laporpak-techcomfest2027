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
  rejectSpamBodySchema,
  resolveEscalatedBodySchema,
  resolveTicketBodySchema,
  ticketDetailQuerySchema,
  transferTicketBodySchema,
  validateTicketBodySchema,
} from "../shared/schemas.js";
import crypto from "node:crypto";
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
import { getRaporData } from "../services/rapor.service.js";
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
    const [activeTicketCount, dept] = await Promise.all([
      prisma.ticket.count({
        where: {
          reporterId: user.id,
          status: { notIn: ["CLOSED", "AUTO_CLOSED", "OUT_OF_SCOPE", "REJECTED_SPAM"] },
        },
      }),
      user.departmentId
        ? prisma.department.findUnique({ where: { id: user.departmentId }, select: { name: true, shortName: true } })
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
      select: { id: true, beforePhotoKey: true, afterPhotoKey: true, isNsfwPendingReview: true },
    });
    if (!ticket) throw new AppError(404, "NOT_FOUND");
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

const PARTNER_INVITE_CODES = {
  "MITRA-DISHUB-2027": "DISHUB",
  "MITRA-PU-2027": "DPU",
  "MITRA-DPU-2027": "DPU",
  "MITRA-DLH-2027": "DLH",
  "MITRA-SATPOLPP-2027": "SATPOLPP",
};

export async function aktivasiMitraController(req, res, next) {
  try {
    const body = aktivasiMitraBodySchema.parse(req.body || {});
    const code = body.activationCode.toUpperCase();
    const departmentId = PARTNER_INVITE_CODES[code];
    if (!departmentId) {
      throw new AppError(401, "UNAUTHORIZED", "Kode aktivasi mitra tidak sah atau tidak dikenali.");
    }

    const codeKey = `mitra:used:${code}`;
    const firstUse = await redis.setNx(codeKey, body.email, 365 * 24 * 3600);
    if (!firstUse) {
      throw new AppError(409, "VERSION_CONFLICT", "Kode aktivasi mitra sekali pakai ini sudah pernah digunakan.");
    }

    const aliasName = body.aliasName || `Mitra-${departmentId}-${crypto.randomInt(100, 999)}`;
    const user = await prisma.user.upsert({
      where: { email: body.email.toLowerCase() },
      create: {
        id: req.user?.id || `mitra_${crypto.randomBytes(8).toString("hex")}`,
        email: body.email.toLowerCase(),
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

export async function cronSlaController(_req, res, next) {
  try {
    await evaluateActiveTicketsBatch();

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
