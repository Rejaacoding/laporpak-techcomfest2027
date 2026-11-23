import { z } from "zod";
import {
  CATEGORY_CODES,
  DEPARTMENT_IDS,
  OUT_OF_SCOPE_CODES,
  STATUS_CODES,
} from "./constants.js";

const coordLat = z.coerce.number().min(-90).max(90);
const coordLng = z.coerce.number().min(-180).max(180);
const gpsAcc = z.coerce.number().positive().max(10000);

export const checkRadiusQuerySchema = z.object({
  lat: coordLat,
  lng: coordLng,
  category: z.enum(CATEGORY_CODES).optional(),
});

export const listTicketsQuerySchema = z.object({
  category: z.enum(CATEGORY_CODES).optional(),
  status: z.enum(STATUS_CODES).optional(),
  departmentId: z.enum(DEPARTMENT_IDS).optional(),
});

export const ticketDetailQuerySchema = z.object({
  lat: coordLat.optional(),
  lng: coordLng.optional(),
  accuracy: gpsAcc.optional(),
});

export const captureNonceBodySchema = z.object({
  actionType: z.enum([
    "CREATE_TICKET",
    "RESOLVE_TICKET",
    "DISPUTE_TICKET",
    "APPEAL_TICKET",
    "RESOLVE_ESCALATED",
  ]),
  ticketId: z.string().min(1).max(64).optional(),
});

export const createTicketBodySchema = z.object({
  title: z.string().trim().min(5, "Judul minimal 5 karakter").max(120, "Judul maksimal 120 karakter"),
  description: z.string().trim().min(10, "Deskripsi minimal 10 karakter").max(1000),
  category: z.enum(CATEGORY_CODES),
  lat: coordLat,
  lng: coordLng,
  gpsAccuracyMeters: gpsAcc,
  captureNonce: z.string().min(10),
  photoBase64: z.string().min(20),
  isLowQualityOverride: z.boolean().optional().default(false),
  clientNsfwScore: z.number().min(0).max(1).optional().default(0),
});

export const validateTicketBodySchema = z.object({
  type: z.enum(["CONFIRM_RESOLVED", "DISPUTE_FALSE"]),
  lat: coordLat.optional(),
  lng: coordLng.optional(),
  gpsAccuracyMeters: gpsAcc.optional(),
  captureNonce: z.string().min(10).optional(),
  photoBase64: z.string().min(20).optional(),
  clientNsfwScore: z.number().min(0).max(1).optional().default(0),
  note: z.string().trim().max(500).optional(),
});

export const transferTicketBodySchema = z.object({
  targetDepartmentId: z.enum(DEPARTMENT_IDS),
  reason: z.string().trim().min(15, "Alasan oper tiket minimal 15 karakter").max(500),
});

export const outOfScopeBodySchema = z.object({
  agency: z.enum(OUT_OF_SCOPE_CODES),
  reason: z.string().trim().min(20, "Catatan rujukan minimal 20 karakter").max(600),
});

export const rejectSpamBodySchema = z.object({
  reason: z.string().trim().min(15, "Alasan penolakan minimal 15 karakter").max(500),
  isNsfwContent: z.boolean().optional().default(false),
});

export const resolveTicketBodySchema = z.object({
  lat: coordLat,
  lng: coordLng,
  gpsAccuracyMeters: gpsAcc,
  captureNonce: z.string().min(10),
  photoBase64: z.string().min(20),
  clientNsfwScore: z.number().min(0).max(1).optional().default(0),
  note: z.string().trim().max(500).optional(),
});

export const resolveEscalatedBodySchema = resolveTicketBodySchema.extend({
  beritaAcaraBase64: z.string().min(20),
  beritaAcaraFilename: z.string().trim().min(3).max(120).optional(),
});

export const jurySessionBodySchema = z.object({
  juryToken: z.string().min(4),
});

export const jurySimulateTimeBodySchema = z.object({
  shiftHours: z.coerce.number().refine((v) => v === 25 || v === 49, {
    message: "Percepatan waktu juri hanya menerima 25 atau 49 jam",
  }),
});

export const mediaSignedUrlQuerySchema = z.object({
  type: z.enum(["before", "after"]).default("before"),
});

export const raporQuerySchema = z.object({
  category: z.enum(CATEGORY_CODES).optional(),
});
