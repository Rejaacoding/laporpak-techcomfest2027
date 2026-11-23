import { HUMAN_ERRORS } from "../shared/constants.js";

export class AppError extends Error {
  constructor(status, code, message, options = {}) {
    super(message || HUMAN_ERRORS[code] || HUMAN_ERRORS.INTERNAL_ERROR);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.details = options.details;
  }
}

export function okResponse(res, data, message = "Berhasil", status = 200) {
  return res.status(status).json({ ok: true, message, data });
}
