import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  FileText,
  LocateFixed,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { DinasSidebar } from "../../components/layout/index.ts";
import type {
  DinasQueueCounts,
  DinasQueueFilterKey,
} from "../../components/layout/index.ts";
import {
  AlertBanners,
  StatOverview,
  TicketTable,
} from "../../components/dinas/index.ts";
import {
  Button,
  Card,
  Input,
  Modal,
  Skeleton,
  Textarea,
  useToast,
} from "../../components/ui/index.js";
import LiveCameraCapture from "../../features/camera/LiveCameraCapture.jsx";
import {
  executeDinasAction,
  fetchSampleAsBase64,
  getRapor,
  issueCaptureNonce,
  listDinasTickets,
  onJuryEvent,
} from "../../lib/api.js";
import { humanizeError } from "../../lib/humanize.js";
import type {
  DinasTicketRow,
  KpiStatItem,
  TicketActionItem,
  TicketStatusCode,
} from "../../data/mockTickets.ts";

interface ApiDinasTicket {
  id: string;
  code: string;
  title: string;
  description?: string;
  category: string;
  categoryLabel: string;
  tier: "DARURAT" | "MENENGAH" | "STANDAR";
  status: TicketStatusCode;
  statusLabel: string;
  publicLat: number;
  publicLng: number;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  isNsfwPendingReview?: boolean;
  reporterAlias: string;
  slaDeadline: string;
  syncedAt: string;
  disputedAt: string | null;
  supportCount: number;
  transferCount: number;
  appealUsed: boolean;
  isChronicOverdue: boolean;
  isFastResolveAnomaly?: boolean;
  outOfScopeAgency?: string | null;
  outOfScopeReason?: string | null;
  rejectedSpamReason?: string | null;
  isDemoData: boolean;
}

type DinasActionCode =
  | "process"
  | "transfer"
  | "out-of-scope"
  | "reject-spam"
  | "resolve"
  | "reprocess-disputed"
  | "counter-dispute"
  | "resolve-escalated";

const DEPARTMENTS = [
  { id: "DISHUB", name: "Dinas Perhubungan (Dishub)" },
  { id: "DPU", name: "Dinas PU Bina Marga" },
  { id: "DLH", name: "Dinas Lingkungan Hidup (DLH)" },
  { id: "SATPOLPP", name: "Satpol PP" },
];

const OUT_OF_SCOPE_AGENCIES = [
  { code: "PLN", label: "PLN (Jaringan Listrik)" },
  { code: "PDAM", label: "PDAM (Pipa Air Bersih)" },
  { code: "BPJN", label: "BPJN (Jalan Nasional)" },
  { code: "BBWS", label: "BBWS (Sungai / Pengairan)" },
  { code: "TELKOM", label: "Telkom / Fiber Optik" },
  { code: "LAINNYA", label: "Instansi Non-Pemda Lainnya" },
];

function formatRelativeSla(
  ticket: ApiDinasTicket,
  nowMs: number
): {
  slaText: string;
  slaTone: DinasTicketRow["slaTone"];
} {
  if (ticket.status === "CLOSED") {
    return { slaText: "Selesai terverifikasi", slaTone: "muted" };
  }
  if (ticket.status === "AUTO_CLOSED") {
    return { slaText: "Tutup otomatis (72j)", slaTone: "muted" };
  }
  if (ticket.status === "OUT_OF_SCOPE") {
    return { slaText: "Dirujuk instansi lain", slaTone: "muted" };
  }
  if (ticket.status === "REJECTED_SPAM") {
    return { slaText: "Ditolak sebagai spam", slaTone: "muted" };
  }
  if (ticket.status === "PENDING_VALIDATION") {
    return { slaText: "Menunggu cek warga", slaTone: "warning" };
  }
  if (ticket.status === "DISPUTED") {
    if (ticket.disputedAt) {
      const remMs =
        new Date(ticket.disputedAt).getTime() + 24 * 3600 * 1000 - nowMs;
      const hrs = Math.max(0, Math.floor(remMs / 3600000));
      const mins = Math.max(0, Math.floor((remMs % 3600000) / 60000));
      return {
        slaText: remMs <= 0 ? "Auto-kerja ulang" : `Respons ${hrs}j ${mins}m`,
        slaTone: "disputed",
      };
    }
    return { slaText: "Batas respons 24j", slaTone: "disputed" };
  }
  if (ticket.status === "ESCALATED") {
    return { slaText: "Wajib Berita Acara", slaTone: "overdue" };
  }

  const diffMs = new Date(ticket.slaDeadline).getTime() - nowMs;
  const absHrs = Math.floor(Math.abs(diffMs) / 3600000);
  const absMins = Math.floor((Math.abs(diffMs) % 3600000) / 60000);
  if (diffMs < 0 || ticket.status === "OVERDUE") {
    return {
      slaText: `Lewat ${absHrs}j ${absMins}m`,
      slaTone: "overdue",
    };
  }
  return {
    slaText: `Sisa ${absHrs}j ${absMins}m`,
    slaTone: diffMs < 6 * 3600 * 1000 ? "warning" : "normal",
  };
}

function buildActionsForTicket(
  t: ApiDinasTicket,
  nowMs: number
): TicketActionItem[] {
  const initialWindowHours = t.tier === "DARURAT" ? 12 : 24;
  const elapsedHours =
    (nowMs - new Date(t.syncedAt).getTime()) / (3600 * 1000);
  const initialWindowOpen = t.status === "OPEN" && elapsedHours <= initialWindowHours;

  if (t.status === "OPEN") {
    const actions: TicketActionItem[] = [
      { id: "process", label: "Mulai Kerjakan", variant: "primary" },
    ];
    actions.push({
      id: "transfer",
      label: "Oper Tiket",
      variant: "secondary",
      disabled: !initialWindowOpen || t.transferCount >= 1,
      disabledReason:
        t.transferCount >= 1
          ? "Oper Tiket maksimal 1 kali per laporan."
          : !initialWindowOpen
            ? `Lewat batas ${initialWindowHours} jam sejak laporan masuk.`
            : undefined,
    });
    actions.push({
      id: "out-of-scope",
      label: "Luar Wewenang",
      variant: "secondary",
    });
    actions.push({
      id: "reject-spam",
      label: "Tolak Spam",
      variant: "danger",
      disabled: !initialWindowOpen,
      disabledReason: !initialWindowOpen
        ? `Lewat batas ${initialWindowHours} jam sejak laporan masuk.`
        : undefined,
    });
    return actions;
  }

  if (t.status === "IN_PROGRESS" || t.status === "OVERDUE") {
    return [{ id: "resolve", label: "Laporkan Selesai", variant: "primary" }];
  }

  if (t.status === "DISPUTED") {
    return [
      {
        id: "reprocess-disputed",
        label: "Kerjakan Ulang",
        variant: "primary",
      },
      {
        id: "counter-dispute",
        label: "Banding Bukti (1×)",
        variant: "secondary",
        disabled: t.appealUsed,
        disabledReason: t.appealUsed
          ? "Banding bukti hanya boleh diajukan 1 kali."
          : undefined,
      },
    ];
  }

  if (t.status === "ESCALATED") {
    return [
      {
        id: "resolve-escalated",
        label: "Unggah Berita Acara",
        variant: "danger",
      },
    ];
  }

  return [];
}

function mapApiToRow(t: ApiDinasTicket, nowMs: number): DinasTicketRow {
  const { slaText, slaTone } = formatRelativeSla(t, nowMs);
  return {
    id: t.code || t.id,
    ticketId: t.id,
    status: t.status,
    categoryTitle: t.title || t.categoryLabel,
    tier: t.tier,
    location: `${t.categoryLabel} · ${t.publicLat.toFixed(4)}, ${t.publicLng.toFixed(4)}`,
    region: t.publicLat < -7.36 ? "Sidoarjo" : "Surabaya",
    slaText,
    slaTone,
    supportCount: t.supportCount,
    isFastResolveAnomaly: Boolean(t.isFastResolveAnomaly),
    actions: buildActionsForTicket(t, nowMs),
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Gagal membaca file dokumen."));
    reader.readAsDataURL(file);
  });
}

/**
 * Meja Kerja Dinas (/dinas) — terhubung 100% ke GET /api/dinas/tickets & 8 endpoint aksi.
 */
export function DinasDashboardPage() {
  const { user, accessToken, isJuryMode } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab =
    (searchParams.get("status") as DinasQueueFilterKey) || "ALL";
  const [activeFilter, setActiveFilter] = useState<DinasQueueFilterKey>(
    ["ALL", "OVERDUE", "DISPUTED", "ESCALATED", "PENDING_VALIDATION", "CLOSED"].includes(
      initialTab
    )
      ? initialTab
      : "ALL"
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const [tickets, setTickets] = useState<ApiDinasTicket[]>([]);
  const [deptScore, setDeptScore] = useState<number>(80);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);

  // Modal state for executing Dinas actions that require confirmation/inputs
  const [selected, setSelected] = useState<{
    ticket: ApiDinasTicket;
    action: TicketActionItem;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Dynamic form fields inside modal
  const [targetDepartmentId, setTargetDepartmentId] = useState("DPU");
  const [agency, setAgency] = useState("PLN");
  const [reason, setReason] = useState("");
  const [isNsfwContent, setIsNsfwContent] = useState(false);
  const [note, setNote] = useState("");
  const [officerLat, setOfficerLat] = useState<number | null>(null);
  const [officerLng, setOfficerLng] = useState<number | null>(null);
  const [officerAcc, setOfficerAcc] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [clientNsfwScore, setClientNsfwScore] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [beritaAcaraBase64, setBeritaAcaraBase64] = useState<string | null>(
    null
  );
  const [beritaAcaraFilename, setBeritaAcaraFilename] = useState("");

  // Pre-warmed capture nonce so photo actions skip extra 1s roundtrip on submit
  const prewarmedNonceRef = useRef<{
    key: string;
    nonce: string;
    expiresAt: number;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchDashboard = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setErrorMsg("");
      try {
        const [listData, raporData] = await Promise.all([
          listDinasTickets({}, accessToken),
          getRapor().catch(() => null),
        ]);
        const items = Array.isArray(listData) ? listData : listData?.tickets || [];
        setTickets(items);
        setNowMs(Date.now());
        if (raporData?.departments && user?.departmentId) {
          const mine = raporData.departments.find(
            (d: { id: string; integrityScore: number }) =>
              d.id === user.departmentId
          );
          if (mine) setDeptScore(Math.round(mine.integrityScore));
        }
      } catch (err) {
        if (!silent) setErrorMsg(humanizeError(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [accessToken, user?.departmentId]
  );

  const prewarmPhotoNonce = useCallback(
    (ticketId: string, actionCode: DinasActionCode) => {
      const nonceAction =
        actionCode === "resolve"
          ? "RESOLVE_TICKET"
          : actionCode === "counter-dispute"
            ? "APPEAL_TICKET"
            : actionCode === "resolve-escalated"
              ? "RESOLVE_ESCALATED"
              : null;
      if (!nonceAction) return;
      const cacheKey = `${ticketId}:${nonceAction}`;
      if (
        prewarmedNonceRef.current &&
        prewarmedNonceRef.current.key === cacheKey &&
        Date.now() < prewarmedNonceRef.current.expiresAt
      ) {
        return;
      }
      issueCaptureNonce({ actionType: nonceAction, ticketId }, accessToken)
        .then((res) => {
          const nonce = res?.captureNonce || res?.nonce;
          if (nonce) {
            prewarmedNonceRef.current = {
              key: cacheKey,
              nonce,
              expiresAt: Date.now() + 240_000,
            };
          }
        })
        .catch(() => {});
    },
    [accessToken]
  );

  const applyServerActionPatch = useCallback(
    (
      ticketId: string,
      actionCode: DinasActionCode,
      serverData: Record<string, unknown> | null
    ) => {
      setTickets((prev) => {
        if (actionCode === "transfer") {
          return prev.filter((item) => item.id !== ticketId);
        }
        return prev.map((item) => {
          if (item.id !== ticketId) return item;
          const nextStatus =
            (serverData?.status as TicketStatusCode) || item.status;
          return {
            ...item,
            status: nextStatus,
            slaDeadline:
              (serverData?.slaDeadline as string) || item.slaDeadline,
            appealUsed:
              actionCode === "counter-dispute" ? true : item.appealUsed,
            isFastResolveAnomaly:
              typeof serverData?.isFastResolveAnomaly === "boolean"
                ? serverData.isFastResolveAnomaly
                : item.isFastResolveAnomaly,
          };
        });
      });
    },
    []
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Listen to JuryPanel events (reset, GPS jump, simulated camera sample)
  useEffect(() => {
    const offReset = onJuryEvent("reset", () => {
      fetchDashboard();
    });
    const offGps = onJuryEvent(
      "gps",
      (coords: { lat: number; lng: number; accuracyMeters?: number }) => {
        setOfficerLat(Number(coords.lat));
        setOfficerLng(Number(coords.lng));
        setOfficerAcc(coords.accuracyMeters ?? 10);
        showToast({
          type: "info",
          message: "Koordinat GPS petugas simulasi diterapkan.",
        });
      }
    );
    const offCapture = onJuryEvent(
      "capture",
      async (detail: { samplePath: string; lat?: number; lng?: number }) => {
        try {
          const b64 = await fetchSampleAsBase64(detail.samplePath);
          setPhotoBase64(b64);
          setClientNsfwScore(0);
          if (detail.lat !== undefined && detail.lng !== undefined) {
            setOfficerLat(Number(detail.lat));
            setOfficerLng(Number(detail.lng));
            setOfficerAcc(10);
          }
          showToast({
            type: "success",
            message: "Foto sampel simulasi juri siap dikirim.",
          });
        } catch (err) {
          showToast({ type: "error", error: err });
        }
      }
    );
    return () => {
      offReset();
      offGps();
      offCapture();
    };
  }, [fetchDashboard, showToast]);

  const handleFilterChange = (next: DinasQueueFilterKey) => {
    setActiveFilter(next);
    const params = new URLSearchParams(searchParams);
    if (next === "ALL") params.delete("status");
    else params.set("status", next);
    setSearchParams(params, { replace: true });
  };

  const counts = useMemo<DinasQueueCounts>(() => {
    return {
      ALL: tickets.length,
      OVERDUE: tickets.filter((t) => t.status === "OVERDUE").length,
      DISPUTED: tickets.filter((t) => t.status === "DISPUTED").length,
      ESCALATED: tickets.filter((t) => t.status === "ESCALATED").length,
      PENDING_VALIDATION: tickets.filter(
        (t) => t.status === "PENDING_VALIDATION"
      ).length,
      CLOSED: tickets.filter(
        (t) => t.status === "CLOSED" || t.status === "AUTO_CLOSED"
      ).length,
    };
  }, [tickets]);

  const kpiStats = useMemo<KpiStatItem[]>(() => {
    const activeOpen = tickets.filter(
      (t) => t.status === "OPEN" || t.status === "IN_PROGRESS"
    ).length;
    return [
      {
        id: "active",
        label: "Antrean Aktif",
        value: String(activeOpen + counts.OVERDUE),
        meta: `${activeOpen} berjalan · ${counts.PENDING_VALIDATION} cek warga`,
        valueTone: "default",
      },
      {
        id: "overdue",
        label: "Melewati Batas Waktu",
        value: String(counts.OVERDUE),
        meta: "Prioritas pengerjaan teratas",
        valueTone: "error",
      },
      {
        id: "disputed",
        label: "Dibantah & Eskalasi",
        value: String(counts.DISPUTED + counts.ESCALATED),
        meta: `${counts.DISPUTED} sengketa · ${counts.ESCALATED} eskalasi`,
        valueTone: "purple",
      },
      {
        id: "score",
        label: "Nilai Kerja Dinas",
        value: `${deptScore} / 100`,
        meta: `${counts.CLOSED} laporan selesai tercatat`,
        valueTone: "brand",
      },
    ];
  }, [tickets, counts, deptScore]);

  const ticketByCodeOrId = useMemo(() => {
    const map = new Map<string, ApiDinasTicket>();
    for (const t of tickets) {
      map.set(t.id, t);
      if (t.code) map.set(t.code, t);
    }
    return map;
  }, [tickets]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets
      .filter((t) => {
        if (activeFilter === "CLOSED") {
          if (t.status !== "CLOSED" && t.status !== "AUTO_CLOSED") return false;
        } else if (activeFilter !== "ALL" && t.status !== activeFilter) {
          return false;
        }
        if (!q) return true;
        return (
          t.id.toLowerCase().includes(q) ||
          (t.code || "").toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.categoryLabel.toLowerCase().includes(q)
        );
      })
      .map((t) => mapApiToRow(t, nowMs));
  }, [tickets, activeFilter, searchQuery, nowMs]);

  const openActionModal = (ticket: ApiDinasTicket, action: TicketActionItem) => {
    const otherDept =
      DEPARTMENTS.find((d) => d.id !== user?.departmentId)?.id || "DPU";
    setTargetDepartmentId(otherDept);
    setAgency("PLN");
    setReason("");
    setIsNsfwContent(false);
    setNote("");
    setPhotoBase64(null);
    setClientNsfwScore(0);
    setBeritaAcaraBase64(null);
    setBeritaAcaraFilename("");
    setModalError("");
    if (isJuryMode) {
      // Pre-fill simulated officer location near the ticket for smooth jury flow
      setOfficerLat(ticket.publicLat);
      setOfficerLng(ticket.publicLng);
      setOfficerAcc(10);
    }
    const actionCode = action.id as DinasActionCode;
    if (
      actionCode === "resolve" ||
      actionCode === "counter-dispute" ||
      actionCode === "resolve-escalated"
    ) {
      prewarmPhotoNonce(ticket.id, actionCode);
    }
    setSelected({ ticket, action });
  };

  const executeQuickProcess = async (ticket: ApiDinasTicket) => {
    const lockKey = `${ticket.id}:process`;
    if (busyActionKey) return;
    setBusyActionKey(lockKey);
    try {
      const serverData = await executeDinasAction(
        ticket.id,
        "process",
        {},
        accessToken
      );
      applyServerActionPatch(ticket.id, "process", serverData);
      showToast({
        type: "success",
        title: "Pengerjaan dimulai",
        message: `${ticket.code} kini berstatus Sedang Ditangani dan tercatat di segel audit.`,
      });
      void fetchDashboard({ silent: true });
    } catch (err) {
      showToast({ type: "error", error: err });
    } finally {
      setBusyActionKey(null);
    }
  };

  const handleRowAction = (row: DinasTicketRow, action: TicketActionItem) => {
    if (action.disabled || busyActionKey) return;
    const raw = ticketByCodeOrId.get(row.ticketId || row.id);
    if (!raw) return;
    if (action.id === "process") {
      void executeQuickProcess(raw);
      return;
    }
    openActionModal(raw, action);
  };

  const requestOfficerGps = () => {
    if (!navigator.geolocation) {
      setModalError("Browser tidak mendukung GPS.");
      return;
    }
    setGpsLoading(true);
    setModalError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficerLat(Number(pos.coords.latitude.toFixed(6)));
        setOfficerLng(Number(pos.coords.longitude.toFixed(6)));
        setOfficerAcc(Math.round(pos.coords.accuracy));
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        setModalError(
          "Gagal mengunci GPS. Aktifkan izin lokasi browser lalu coba lagi."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleBeritaAcaraUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setModalError("Ukuran berkas Berita Acara maksimal 5 MB.");
      return;
    }
    try {
      const b64 = await readFileAsBase64(file);
      setBeritaAcaraBase64(b64);
      setBeritaAcaraFilename(file.name);
      setModalError("");
    } catch (err) {
      setModalError(humanizeError(err));
    }
  };

  const handleUseDemoBeritaAcara = async () => {
    try {
      const b64 = await fetchSampleAsBase64("/samples/berita-acara-sample.pdf");
      setBeritaAcaraBase64(b64);
      setBeritaAcaraFilename("berita-acara-sample.pdf");
      setModalError("");
    } catch (err) {
      setModalError(humanizeError(err));
    }
  };

  const handleSubmitAction = async () => {
    if (!selected) return;
    const actionCode = selected.action.id as DinasActionCode;
    const ticketId = selected.ticket.id;
    setModalError("");

    // Client-side parity validation matching src/shared/schemas.js
    if (actionCode === "transfer" && reason.trim().length < 15) {
      setModalError("Alasan oper tiket wajib minimal 15 karakter.");
      return;
    }
    if (actionCode === "reject-spam" && reason.trim().length < 15) {
      setModalError("Alasan penolakan spam wajib minimal 15 karakter.");
      return;
    }
    if (actionCode === "out-of-scope" && reason.trim().length < 20) {
      setModalError("Catatan rujukan instansi luar wajib minimal 20 karakter.");
      return;
    }

    const needsPhoto =
      actionCode === "resolve" ||
      actionCode === "counter-dispute" ||
      actionCode === "resolve-escalated";

    if (needsPhoto) {
      if (officerLat === null || officerLng === null) {
        setModalError("Kunci lokasi GPS petugas (<= 75 m dari titik) dulu.");
        return;
      }
      if (officerAcc !== null && officerAcc > 50) {
        setModalError(
          `Akurasi GPS masih ${officerAcc} m (wajib <= 50 m). Perbarui lokasi di area terbuka.`
        );
        return;
      }
      if (!photoBase64) {
        setModalError("Ambil foto lapangan langsung terlebih dahulu.");
        return;
      }
    }
    if (actionCode === "resolve-escalated" && !beritaAcaraBase64) {
      setModalError("Unggah dokumen Berita Acara (PDF/JPG/PNG <= 5 MB) dulu.");
      return;
    }

    setSubmitting(true);
    try {
      let body: Record<string, unknown> = {};

      if (actionCode === "transfer") {
        body = { targetDepartmentId, reason: reason.trim() };
      } else if (actionCode === "out-of-scope") {
        body = { agency, reason: reason.trim() };
      } else if (actionCode === "reject-spam") {
        body = { reason: reason.trim(), isNsfwContent };
      } else if (needsPhoto) {
        const nonceAction =
          actionCode === "resolve"
            ? "RESOLVE_TICKET"
            : actionCode === "counter-dispute"
              ? "APPEAL_TICKET"
              : "RESOLVE_ESCALATED";
        const cacheKey = `${ticketId}:${nonceAction}`;
        let captureNonce: string | undefined;
        if (
          prewarmedNonceRef.current &&
          prewarmedNonceRef.current.key === cacheKey &&
          Date.now() < prewarmedNonceRef.current.expiresAt
        ) {
          captureNonce = prewarmedNonceRef.current.nonce;
          prewarmedNonceRef.current = null;
        } else {
          const nonceRes = await issueCaptureNonce(
            { actionType: nonceAction, ticketId },
            accessToken
          );
          captureNonce = nonceRes?.captureNonce || nonceRes?.nonce;
        }
        body = {
          lat: officerLat,
          lng: officerLng,
          gpsAccuracyMeters: officerAcc ?? 15,
          captureNonce,
          photoBase64,
          clientNsfwScore,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(actionCode === "resolve-escalated"
            ? { beritaAcaraBase64, beritaAcaraFilename }
            : {}),
        };
      }

      const serverData = await executeDinasAction(
        ticketId,
        actionCode,
        body,
        accessToken
      );
      applyServerActionPatch(ticketId, actionCode, serverData);
      showToast({
        type: "success",
        title: `${selected.action.label} berhasil`,
        message: `${selected.ticket.code} berhasil diperbarui dan tercatat di segel audit.`,
      });
      setSelected(null);
      void fetchDashboard({ silent: true });
    } catch (err) {
      const msg = humanizeError(err);
      setModalError(msg);
      showToast({ type: "error", error: err });
    } finally {
      setSubmitting(false);
    }
  };

  const firstDisputed = useMemo(() => {
    const t = tickets.find((item) => item.status === "DISPUTED");
    if (!t) return null;
    const { slaText } = formatRelativeSla(t, nowMs);
    return {
      id: t.id,
      code: t.code,
      title: t.title,
      countdownText: slaText,
      appealUsed: t.appealUsed,
    };
  }, [tickets, nowMs]);

  const firstEscalated = useMemo(() => {
    const t = tickets.find((item) => item.status === "ESCALATED");
    if (!t) return null;
    return { id: t.id, code: t.code, title: t.title };
  }, [tickets]);

  const activeActionCode = selected?.action.id as DinasActionCode | undefined;
  const needsPhotoModal =
    activeActionCode === "resolve" ||
    activeActionCode === "counter-dispute" ||
    activeActionCode === "resolve-escalated";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg text-fg flex flex-col">
      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        <DinasSidebar
          departmentName={user?.departmentName || "Instansi Mitra"}
          regionLabel="Kota Surabaya & Kab. Sidoarjo"
          isVerifiedPartner
          integrityScore={deptScore}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          counts={counts}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-7 flex flex-col gap-5">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="font-head font-bold text-2xl md:text-[30px] md:leading-9 text-fg">
                Meja Kerja Antrean Dinas
              </h1>
              <p className="font-sans text-sm leading-5 text-fg-muted">
                Data nyata {user?.departmentName || "instansi"} · Diurutkan
                otomatis dari yang melewati batas waktu dan sisa waktu tersingkat
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
              <Input
                density="dinas"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode / judul laporan..."
                aria-label="Cari laporan di antrean dinas"
                leftIcon={<Search className="size-4" />}
                wrapperClassName="w-full sm:w-[240px]"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void fetchDashboard()}
                loading={loading}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>Segarkan</span>
              </Button>
            </div>
          </header>

          {errorMsg && (
            <Card className="border-red-300 bg-red-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-sm text-red-800">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void fetchDashboard()}>
                Coba Lagi
              </Button>
            </Card>
          )}

          {loading && tickets.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-32" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              <StatOverview stats={kpiStats} />

              <AlertBanners
                disputedTicket={firstDisputed}
                escalatedTicket={firstEscalated}
                onProcessRework={(tid) => {
                  const t = ticketByCodeOrId.get(tid);
                  if (t) {
                    openActionModal(t, {
                      id: "reprocess-disputed",
                      label: "Kerjakan Ulang",
                      variant: "primary",
                    });
                  }
                }}
                onAppealEvidence={(tid) => {
                  const t = ticketByCodeOrId.get(tid);
                  if (t) {
                    openActionModal(t, {
                      id: "counter-dispute",
                      label: "Banding Bukti (1×)",
                      variant: "secondary",
                    });
                  }
                }}
                onUploadEscalation={(tid) => {
                  const t = ticketByCodeOrId.get(tid);
                  if (t) {
                    openActionModal(t, {
                      id: "resolve-escalated",
                      label: "Unggah Berita Acara",
                      variant: "danger",
                    });
                  }
                }}
              />

              <TicketTable
                tickets={filteredRows}
                activeTab={activeFilter}
                onTabChange={handleFilterChange}
                counts={counts}
                busyActionKey={busyActionKey}
                onAction={handleRowAction}
                onResetFilters={() => {
                  handleFilterChange("ALL");
                  setSearchQuery("");
                }}
              />
            </>
          )}
        </main>
      </div>

      {/* Modal Aksi Dinas Lengkap (8 Aksi Backend Terverifikasi) */}
      <Modal
        open={Boolean(selected)}
        onClose={() => !submitting && setSelected(null)}
        title={
          selected
            ? `${selected.action.label} — ${selected.ticket.code}`
            : undefined
        }
        description={
          selected
            ? `${selected.ticket.title} (${selected.ticket.categoryLabel})`
            : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {selected && (selected.ticket.beforePhotoUrl || selected.ticket.description || selected.ticket.isNsfwPendingReview) && (
            <div className="rounded-xl border border-line bg-surface-2/60 p-3 flex flex-col sm:flex-row gap-3">
              {selected.ticket.isNsfwPendingReview ? (
                <div className="sm:w-28 h-20 rounded-lg border border-amber-300 bg-amber-50 flex items-center justify-center px-2 text-center text-[11px] font-medium text-amber-900 shrink-0">
                  Foto ditahan (tinjauan NSFW)
                </div>
              ) : selected.ticket.beforePhotoUrl ? (
                <img
                  src={selected.ticket.beforePhotoUrl}
                  alt={`Foto bukti awal ${selected.ticket.code}`}
                  className="sm:w-28 h-20 rounded-lg object-cover border border-line shrink-0"
                />
              ) : null}
              <div className="min-w-0 space-y-1 text-xs">
                <p className="font-semibold text-fg">
                  Bukti Awal Pelapor ({selected.ticket.reporterAlias})
                </p>
                {selected.ticket.description && (
                  <p className="text-fg-muted line-clamp-3">
                    {selected.ticket.description}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeActionCode === "transfer" && (
            <>
              <div>
                <label
                  htmlFor="dinas-transfer-target"
                  className="block text-sm font-medium mb-1"
                >
                  Instansi Pemda Tujuan
                </label>
                <select
                  id="dinas-transfer-target"
                  value={targetDepartmentId}
                  onChange={(e) => setTargetDepartmentId(e.target.value)}
                  className="w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg"
                >
                  {DEPARTMENTS.filter((d) => d.id !== user?.departmentId).map(
                    (d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    )
                  )}
                </select>
              </div>
              <Textarea
                label="Alasan Oper Tiket"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minChars={15}
                maxLength={500}
                placeholder="Jelaskan mengapa laporan ini menjadi wewenang dinas tujuan (min. 15 karakter)..."
              />
            </>
          )}

          {activeActionCode === "out-of-scope" && (
            <>
              <div>
                <label
                  htmlFor="dinas-oos-agency"
                  className="block text-sm font-medium mb-1"
                >
                  Instansi Rujukan Non-Pemda
                </label>
                <select
                  id="dinas-oos-agency"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className="w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg"
                >
                  {OUT_OF_SCOPE_AGENCIES.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                label="Catatan Rujukan ke Warga"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minChars={20}
                maxLength={600}
                placeholder="Jelaskan aset milik instansi mana dan kanal pengaduan rujukannya (min. 20 karakter)..."
              />
            </>
          )}

          {activeActionCode === "reject-spam" && (
            <div className="space-y-3">
              <Textarea
                label="Alasan Penolakan Spam / Tidak Relevan"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minChars={15}
                maxLength={500}
                placeholder="Jelaskan alasan penolakan secara transparan (min. 15 karakter, tampil di linimasa tiket)..."
              />
              <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/50 p-3 text-xs text-fg cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNsfwContent}
                  onChange={(e) => setIsNsfwContent(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-line accent-red-600"
                />
                <span>
                  <strong className="block font-semibold">
                    Foto berisi konten tidak pantas / NSFW
                  </strong>
                  <span className="text-fg-muted">
                    Centang untuk menghapus foto secara permanen segera (bukan karantina 7 hari).
                  </span>
                </span>
              </label>
            </div>
          )}

          {needsPhotoModal && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/60 p-3">
                <div className="text-xs font-mono text-fg-muted">
                  {officerLat !== null && officerLng !== null
                    ? `${officerLat.toFixed(4)}, ${officerLng.toFixed(4)} (±${officerAcc ?? "?"} m)`
                    : "Lokasi GPS petugas belum dikunci"}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={gpsLoading}
                  onClick={requestOfficerGps}
                >
                  <LocateFixed className="size-4" aria-hidden="true" />
                  Kunci GPS
                </Button>
              </div>

              {photoBase64 ? (
                <div className="space-y-2">
                  <img
                    src={photoBase64}
                    alt="Bukti foto lapangan petugas"
                    className="aspect-video w-full rounded-xl object-cover border border-line"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCameraOpen(true)}
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    Foto Ulang
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera className="size-4" aria-hidden="true" />
                  Buka Kamera Langsung (&le;75 m)
                </Button>
              )}

              {activeActionCode === "resolve-escalated" && (
                <div className="rounded-xl border border-line bg-surface-2/50 p-3 space-y-2">
                  <label className="block text-xs font-semibold text-fg">
                    Dokumen Berita Acara Resmi (PDF / JPG / PNG &le; 5 MB)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={handleBeritaAcaraUpload}
                    className="block w-full text-xs text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand"
                  />
                  {isJuryMode && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleUseDemoBeritaAcara}
                    >
                      <FileText className="size-4" aria-hidden="true" />
                      Pakai Sampel PDF Berita Acara (Demo Juri)
                    </Button>
                  )}
                  {beritaAcaraFilename && (
                    <p className="text-xs font-mono text-semantic-success">
                      Berkas siap: {beritaAcaraFilename}
                    </p>
                  )}
                </div>
              )}

              <Input
                label="Catatan Petugas (Opsional)"
                density="dinas"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mis. Lubang aspal sudah ditambal hotmix..."
              />
            </div>
          )}

          {(activeActionCode === "process" ||
            activeActionCode === "reprocess-disputed") && (
            <p className="font-sans text-sm text-fg-muted">
              {activeActionCode === "process"
                ? "Status laporan akan berubah menjadi Sedang Ditangani dan tercatat ke segel audit."
                : "Laporan dikembalikan ke Sedang Ditangani dengan tambahan waktu pengerjaan +24 jam."}
            </p>
          )}

          {modalError && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {modalError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="md"
              disabled={submitting}
              onClick={() => setSelected(null)}
            >
              Batal
            </Button>
            <Button
              variant={
                selected?.action.variant === "danger" ? "danger" : "primary"
              }
              size="md"
              loading={submitting}
              onClick={handleSubmitAction}
            >
              {submitting ? "Menyimpan..." : `Konfirmasi ${selected?.action.label}`}
            </Button>
          </div>
        </div>
      </Modal>

      <LiveCameraCapture
        open={cameraOpen}
        publicLat={officerLat ?? selected?.ticket.publicLat ?? -7.4478}
        publicLng={officerLng ?? selected?.ticket.publicLng ?? 112.7183}
        gpsAccuracy={officerAcc}
        categoryCode={selected?.ticket.category || "JALAN_BERLUBANG"}
        onClose={() => setCameraOpen(false)}
        onCapture={({
          photoBase64: b64,
          clientNsfwScore: score,
        }: {
          photoBase64: string;
          clientNsfwScore?: number;
        }) => {
          setPhotoBase64(b64);
          setClientNsfwScore(score ?? 0);
          setCameraOpen(false);
        }}
      />
    </div>
  );
}

export default DinasDashboardPage;
