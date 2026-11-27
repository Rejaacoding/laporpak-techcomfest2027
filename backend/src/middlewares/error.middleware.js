import crypto from "node:crypto";
import { ZodError } from "zod";
import { HUMAN_ERRORS } from "../shared/constants.js";
import { AppError } from "../lib/errors.js";

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join(".") || "body",
      issue: i.message,
    }));
    return res.status(422).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: details[0]?.issue || HUMAN_ERRORS.VALIDATION_ERROR,
        retryable: false,
        details,
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      ok: false,
      error: {
        code: "MEDIA_INVALID",
        message: "Ukuran file terlalu besar. Pastikan foto lapangan <= 450 KB atau Berita Acara <= 5 MB.",
        retryable: false,
      },
    });
  }

  if (err?.code === "P2002") {
    return res.status(409).json({
      ok: false,
      error: {
        code: "VERSION_CONFLICT",
        message: HUMAN_ERRORS.VERSION_CONFLICT,
        retryable: true,
      },
    });
  }

  if (err?.code === "P2025") {
    return res.status(404).json({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: HUMAN_ERRORS.NOT_FOUND,
        retryable: false,
      },
    });
  }

  // PostgreSQL lock_timeout (55P03) atau deadlock (40P01) -> 409 retryable ramah warga
  if (err?.code === "55P03" || err?.code === "40P01" || err?.meta?.code === "55P03") {
    return res.status(409).json({
      ok: false,
      error: {
        code: "VERSION_CONFLICT",
        message: HUMAN_ERRORS.VERSION_CONFLICT,
        retryable: true,
      },
    });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.error(`[LaporPAK Error ${requestId}] ${req.method} ${req.originalUrl.split("?")[0]}:`, err);

  return res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: HUMAN_ERRORS.INTERNAL_ERROR,
      retryable: true,
      details: { requestId },
    },
  });
}
