import {
  AlarmClock,
  CheckCircle2,
  Inbox,
  MessageSquareWarning,
  Scale,
  ShieldCheck,
  Siren,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/index.js";

export type DinasQueueFilterKey =
  | "ALL"
  | "OVERDUE"
  | "DISPUTED"
  | "ESCALATED"
  | "PENDING_VALIDATION"
  | "CLOSED";

export interface DinasQueueCounts {
  ALL: number;
  OVERDUE: number;
  DISPUTED: number;
  ESCALATED: number;
  PENDING_VALIDATION: number;
  CLOSED: number;
}

export interface DinasSidebarProps {
  /** Nama lengkap instansi (contoh: "Dinas PU Bina Marga & Pematusan") */
  departmentName?: string;
  /** Cakupan wilayah layanan */
  regionLabel?: string;
  /** Status verifikasi mitra */
  isVerifiedPartner?: boolean;
  /** Skor integritas dinas (0–100, default awal mitra 80) */
  integrityScore?: number;
  /** Filter antrean yang sedang aktif */
  activeFilter: DinasQueueFilterKey;
  /** Handler perpindahan filter antrean */
  onFilterChange: (filter: DinasQueueFilterKey) => void;
  /** Jumlah tiket per kategori filter */
  counts?: Partial<DinasQueueCounts>;
  className?: string;
}

interface QueueMenuItem {
  key: DinasQueueFilterKey;
  label: string;
  Icon: LucideIcon;
  countClass: string;
}

const QUEUE_MENU_ITEMS: QueueMenuItem[] = [
  {
    key: "ALL",
    label: "Semua Antrean",
    Icon: Inbox,
    countClass: "bg-brand-soft text-brand",
  },
  {
    key: "OVERDUE",
    label: "Melewati Tenggat",
    Icon: AlarmClock,
    countClass: "bg-red-100 text-red-800",
  },
  {
    key: "DISPUTED",
    label: "Dibantah Warga",
    Icon: MessageSquareWarning,
    countClass: "bg-purple-100 text-purple-800",
  },
  {
    key: "ESCALATED",
    label: "Eskalasi Pengawasan",
    Icon: Siren,
    countClass: "bg-red-900 text-red-50",
  },
  {
    key: "PENDING_VALIDATION",
    label: "Menunggu Cek Warga",
    Icon: Scale,
    countClass: "bg-orange-100 text-orange-900",
  },
  {
    key: "CLOSED",
    label: "Tuntas Terverifikasi",
    Icon: CheckCircle2,
    countClass: "bg-green-100 text-green-800",
  },
];

function getScoreVisuals(score: number) {
  if (score >= 70) {
    return {
      textClass: "text-green-700",
      barClass: "bg-green-600",
    };
  }
  if (score >= 40) {
    return {
      textClass: "text-amber-700",
      barClass: "bg-amber-500",
    };
  }
  return {
    textClass: "text-red-700",
    barClass: "bg-red-600",
  };
}

/**
 * Dinas Sidebar — matched to Figma "Sidebar / Dinas Navigation (256px)"
 * Desktop w-64 (256px), bg-surface (#FFFFFF), border-r border-line (#E7DFD3).
 * Collapses into a scrollable horizontal filter strip on mobile (<lg) per docs/design.md §6.1.
 */
export function DinasSidebar({
  departmentName = "Dinas PU Bina Marga & Pematusan",
  regionLabel = "Kota Surabaya & Kab. Sidoarjo",
  isVerifiedPartner = true,
  integrityScore = 84,
  activeFilter,
  onFilterChange,
  counts = {},
  className = "",
}: DinasSidebarProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(integrityScore)));
  const scoreVisuals = getScoreVisuals(clampedScore);

  return (
    <aside
      aria-label="Navigasi antrean dinas"
      className={[
        "w-full lg:w-64 shrink-0 bg-surface",
        "border-b lg:border-b-0 lg:border-r border-line",
        "px-[18px] py-5 lg:py-6",
        "flex flex-col gap-5",
        className,
      ].join(" ")}
    >
      {/* 1. Kartu Profil Dinas & Skor Integritas */}
      <Card
        density="none"
        className="!bg-surface-2 !shadow-none p-3.5 rounded-2xl border border-line flex flex-col gap-2.5"
      >
        {isVerifiedPartner && (
          <span className="inline-flex items-center gap-[5px] self-start rounded-full bg-brand-soft px-2 py-[3px]">
            <ShieldCheck className="size-3 text-brand shrink-0" aria-hidden="true" />
            <span className="font-mono font-bold text-[10px] leading-[14px] text-brand">
              Mitra Terverifikasi
            </span>
          </span>
        )}

        <div className="flex flex-col gap-1">
          <h2 className="font-head font-semibold text-base leading-[22px] text-fg">
            {departmentName}
          </h2>
          <p className="font-sans text-xs leading-4 text-fg-muted">
            {regionLabel}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans text-xs leading-4 text-fg-muted">
              Skor Integritas
            </span>
            <span
              className={[
                "font-mono font-bold text-sm leading-[18px] tabular-nums",
                scoreVisuals.textClass,
              ].join(" ")}
            >
              {clampedScore} / 100
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Skor integritas dinas"
            aria-valuenow={clampedScore}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full rounded-full bg-surface overflow-hidden"
          >
            <div
              className={[
                "h-full rounded-full transition-all duration-300 ease-out motion-reduce:transition-none",
                scoreVisuals.barClass,
              ].join(" ")}
              style={{ width: `${clampedScore}%` }}
            />
          </div>
        </div>
      </Card>

      {/* 2. Daftar Filter Antrean Tiket */}
      <nav aria-label="Filter antrean tiket" className="flex flex-col gap-1">
        <span className="font-mono font-bold text-[10px] leading-[14px] text-fg-muted tracking-wider uppercase px-1 mb-0.5">
          ANTREAN TIKET
        </span>

        <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
          {QUEUE_MENU_ITEMS.map(({ key, label, Icon, countClass }) => {
            const active = activeFilter === key;
            const count = counts[key] ?? 0;

            return (
              <li key={key} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => onFilterChange(key)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "w-full min-h-9 px-2.5 py-[9px] rounded-[10px]",
                    "flex items-center gap-2.5 text-left whitespace-nowrap",
                    "transition duration-150 ease-out motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    active
                      ? "bg-brand-soft text-brand font-semibold"
                      : "text-fg font-normal hover:bg-surface-2",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "size-4 shrink-0",
                      active ? "text-brand" : "text-fg-muted",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span className="flex-1 font-sans text-sm leading-[18px] truncate">
                    {label}
                  </span>
                  <span
                    className={[
                      "inline-flex items-center justify-center rounded-full px-[7px] py-[2px]",
                      "font-mono font-bold text-[11px] leading-[14px] tabular-nums shrink-0",
                      active ? "bg-brand-soft text-brand" : countClass,
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 3. Kotak Info Aturan Oper & Tolak Spam */}
      <Card
        density="none"
        className="!bg-bg !shadow-none p-3 rounded-xl border border-line hidden lg:flex flex-col gap-1.5"
      >
        <h3 className="font-head font-semibold text-xs leading-4 text-fg">
          Aturan Oper &amp; Tolak Spam
        </h3>
        <p className="font-sans text-xs leading-4 text-fg-muted">
          Hanya tersedia saat status Laporan Masuk dalam batas min(24j, 50% SLA
          awal) sejak syncedAt. Maksimal 1× Oper Tiket per laporan.
        </p>
      </Card>
    </aside>
  );
}

export default DinasSidebar;
