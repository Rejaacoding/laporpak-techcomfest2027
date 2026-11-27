import { HUMAN_ERRORS } from "../constants/designTokens.js";

const HTTP_STATUS_MAP = {
  400: HUMAN_ERRORS.VALIDATION_ERROR,
  401: HUMAN_ERRORS.UNAUTHORIZED,
  403: HUMAN_ERRORS.FORBIDDEN,
  404: HUMAN_ERRORS.NOT_FOUND,
  408: "Waktu tunggu koneksi habis. Periksa internetmu lalu tekan Coba Lagi.",
  409: HUMAN_ERRORS.VERSION_CONFLICT,
  413: "Ukuran foto atau berkas terlalu besar. Coba ambil ulang dengan resolusi lebih ringan.",
  422: HUMAN_ERRORS.VALIDATION_ERROR,
  429: HUMAN_ERRORS.RATE_LIMITED,
  500: HUMAN_ERRORS.INTERNAL_ERROR,
  502: HUMAN_ERRORS.INTERNAL_ERROR,
  503: "Layanan sedang sibuk sementara. Silakan tunggu beberapa saat lalu coba lagi.",
  504: "Layanan membutuhkan waktu terlalu lama merespons. Silakan tekan Coba Lagi.",
};

const TECHNICAL_LEAK_PATTERN =
  /\b(400|401|403|404|408|409|413|422|429|500|502|503|504)\b|prisma|syntaxerror|typeerror|referenceerror|econnrefused|jwt|uuid|sql|stack|internal server error|unprocessable entity|conflict/i;

const AUTH_MESSAGE_PATTERNS = [
  {
    pattern: /invalid login credentials|invalid_credentials/i,
    message: "Email atau kata sandi tidak cocok.",
  },
  {
    pattern: /email not confirmed/i,
    message: "Email belum dikonfirmasi. Cek kotak masukmu lalu coba lagi.",
  },
  {
    pattern: /user already registered|already been registered/i,
    message: "Email ini sudah terdaftar. Silakan langsung masuk.",
  },
  {
    pattern: /password should be at least/i,
    message: "Kata sandi minimal 6 karakter.",
  },
  {
    pattern: /jwt expired|token has expired|session_expired|refresh_token_not_found/i,
    message: "Sesi sudah kedaluwarsa, silakan masuk kembali.",
  },
  {
    pattern: /rate limit|too many requests/i,
    message: HUMAN_ERRORS.RATE_LIMITED,
  },
  {
    pattern: /oauth|popup_closed_by_user|access_denied/i,
    message: "Proses masuk dengan Google dibatalkan atau gagal. Silakan coba lagi.",
  },
];

/**
 * Translate an HTTP status code into a human-friendly Indonesian message.
 */
export function humanizeHttpStatus(status) {
  const numeric = Number(status);
  if (HTTP_STATUS_MAP[numeric]) {
    return HTTP_STATUS_MAP[numeric];
  }
  if (numeric >= 500) {
    return HUMAN_ERRORS.INTERNAL_ERROR;
  }
  if (numeric >= 400) {
    return HUMAN_ERRORS.VALIDATION_ERROR;
  }
  return HUMAN_ERRORS.INTERNAL_ERROR;
}

/**
 * Ensure no raw HTTP status codes or technical jargon leak to the UI.
 */
export function sanitizeUserMessage(rawMessage, fallback = HUMAN_ERRORS.INTERNAL_ERROR) {
  if (typeof rawMessage !== "string") {
    return fallback;
  }
  const trimmed = rawMessage.trim();
  if (!trimmed) {
    return fallback;
  }
  if (TECHNICAL_LEAK_PATTERN.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

/**
 * Kamus Bahasa Manusia: converts any Error, API payload, HTTP status, or string
 * into a safe, empathetic Indonesian message without raw HTTP/error codes.
 */
export function humanizeError(input, fallback = HUMAN_ERRORS.INTERNAL_ERROR) {
  if (!input) {
    return fallback;
  }

  if (typeof input === "number") {
    return humanizeHttpStatus(input);
  }

  if (typeof input === "string") {
    const upper = input.trim().toUpperCase();
    if (HUMAN_ERRORS[upper]) {
      return HUMAN_ERRORS[upper];
    }
    const statusMatch = input.match(/\b(400|401|403|404|408|409|413|422|429|500|502|503|504)\b/);
    if (statusMatch) {
      return humanizeHttpStatus(Number(statusMatch[1]));
    }
    return sanitizeUserMessage(input, fallback);
  }

  // Handle network/offline/abort errors
  if (input?.name === "AbortError") {
    return "Permintaan dibatalkan atau melebihi batas waktu. Silakan coba lagi.";
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.onLine === false
  ) {
    return "Koneksi internet terputus. Simpanan datamu tetap aman dan akan siap dikirim saat tersambung kembali.";
  }
  if (
    input instanceof TypeError &&
    /fetch|network|load failed/i.test(input.message || "")
  ) {
    return HUMAN_ERRORS.INTERNAL_ERROR;
  }

  // Extract structured API error code & status
  const code =
    input?.response?.data?.code ||
    input?.data?.code ||
    input?.code;
  if (typeof code === "string" && HUMAN_ERRORS[code.toUpperCase()]) {
    return HUMAN_ERRORS[code.toUpperCase()];
  }

  const status =
    input?.response?.status ??
    input?.status ??
    input?.statusCode;

  const rawMessage =
    input?.response?.data?.message ||
    input?.data?.message ||
    input?.error_description ||
    input?.message;

  if (typeof rawMessage === "string") {
    for (const rule of AUTH_MESSAGE_PATTERNS) {
      if (rule.pattern.test(rawMessage)) {
        return rule.message;
      }
    }
    if (!TECHNICAL_LEAK_PATTERN.test(rawMessage)) {
      const trimmed = rawMessage.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  if (status) {
    return humanizeHttpStatus(status);
  }

  return fallback;
}

/**
 * Build a sanitized toast payload. Kept pure so the exact title/message that
 * reaches the UI can be pinned by Node unit tests without JSX.
 */
export function buildToastPayload({ type = "info", title, message, error } = {}) {
  const isError = type === "error" || Boolean(error);
  const rawMessage = error ?? message;
  const safeMessage = rawMessage
    ? isError
      ? humanizeError(rawMessage)
      : message
    : "";
  const safeTitle = title ? (isError ? humanizeError(title) : title) : undefined;

  return {
    type,
    ...(safeTitle ? { title: safeTitle } : {}),
    message: safeMessage,
  };
}
