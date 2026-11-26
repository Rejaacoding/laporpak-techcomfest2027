import type { HTMLAttributes, ReactNode } from "react";
import {
  AlarmClock,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  Flame,
  Info,
  MessageSquareWarning,
  Scale,
  ShieldX,
  Siren,
  Timer,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BadgeStatus =
  | "Darurat"
  | "Menengah"
  | "Standar"
  | "Melewati Tenggat"
  | "Dibantah"
  | "Tuntas"
  | "DARURAT"
  | "MENENGAH"
  | "STANDAR"
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING_VALIDATION"
  | "OVERDUE"
  | "DISPUTED"
  | "ESCALATED"
  | "CLOSED"
  | "AUTO_CLOSED"
  | "OUT_OF_SCOPE"
  | "REJECTED_SPAM";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "info";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Preset status or SLA tier matching Figma UI Kit Badges & Tags */
  status?: BadgeStatus | string;
  /** Generic semantic tone when not using a preset status */
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Custom icon override (set null to hide icon on non-status generic tags) */
  icon?: ReactNode | null;
  children?: ReactNode;
}

interface PresetConfig {
  label: string;
  Icon: LucideIcon;
  className: string;
  mono?: boolean;
}

const STATUS_PRESETS: Record<string, PresetConfig> = {
  // SLA Tiers
  Darurat: {
    label: "DARURAT · 24J",
    Icon: Flame,
    className:
      "bg-red-50 text-red-700 border border-red-200 [[data-theme=slate]_&]:bg-red-500/15 [[data-theme=slate]_&]:text-red-300 [[data-theme=slate]_&]:border-red-500/30",
    mono: true,
  },
  DARURAT: {
    label: "DARURAT · 24J",
    Icon: Flame,
    className:
      "bg-red-50 text-red-700 border border-red-200 [[data-theme=slate]_&]:bg-red-500/15 [[data-theme=slate]_&]:text-red-300 [[data-theme=slate]_&]:border-red-500/30",
    mono: true,
  },
  Menengah: {
    label: "MENENGAH · 72J",
    Icon: Timer,
    className:
      "bg-amber-50 text-amber-800 border border-amber-200 [[data-theme=slate]_&]:bg-amber-500/15 [[data-theme=slate]_&]:text-amber-300 [[data-theme=slate]_&]:border-amber-500/30",
    mono: true,
  },
  MENENGAH: {
    label: "MENENGAH · 72J",
    Icon: Timer,
    className:
      "bg-amber-50 text-amber-800 border border-amber-200 [[data-theme=slate]_&]:bg-amber-500/15 [[data-theme=slate]_&]:text-amber-300 [[data-theme=slate]_&]:border-amber-500/30",
    mono: true,
  },
  Standar: {
    label: "STANDAR · 168J",
    Icon: Clock,
    className:
      "bg-blue-50 text-blue-800 border border-blue-200 [[data-theme=slate]_&]:bg-blue-500/15 [[data-theme=slate]_&]:text-blue-300 [[data-theme=slate]_&]:border-blue-500/30",
    mono: true,
  },
  STANDAR: {
    label: "STANDAR · 168J",
    Icon: Clock,
    className:
      "bg-blue-50 text-blue-800 border border-blue-200 [[data-theme=slate]_&]:bg-blue-500/15 [[data-theme=slate]_&]:text-blue-300 [[data-theme=slate]_&]:border-blue-500/30",
    mono: true,
  },

  // Human-readable & Enum 10-Status Presets
  "Melewati Tenggat": {
    label: "Melewati Tenggat",
    Icon: AlarmClock,
    className:
      "bg-red-100 text-red-800 [[data-theme=slate]_&]:bg-red-500/15 [[data-theme=slate]_&]:text-red-300",
  },
  OVERDUE: {
    label: "Melewati Tenggat",
    Icon: AlarmClock,
    className:
      "bg-red-100 text-red-800 [[data-theme=slate]_&]:bg-red-500/15 [[data-theme=slate]_&]:text-red-300",
  },
  Dibantah: {
    label: "Dibantah Warga",
    Icon: MessageSquareWarning,
    className:
      "bg-purple-100 text-purple-800 [[data-theme=slate]_&]:bg-purple-500/15 [[data-theme=slate]_&]:text-purple-300",
  },
  DISPUTED: {
    label: "Dibantah Warga",
    Icon: MessageSquareWarning,
    className:
      "bg-purple-100 text-purple-800 [[data-theme=slate]_&]:bg-purple-500/15 [[data-theme=slate]_&]:text-purple-300",
  },
  Tuntas: {
    label: "Tuntas Terverifikasi",
    Icon: CheckCircle2,
    className:
      "bg-green-100 text-green-800 [[data-theme=slate]_&]:bg-green-500/15 [[data-theme=slate]_&]:text-green-300",
  },
  CLOSED: {
    label: "Tuntas Terverifikasi",
    Icon: CheckCircle2,
    className:
      "bg-green-100 text-green-800 [[data-theme=slate]_&]:bg-green-500/15 [[data-theme=slate]_&]:text-green-300",
  },
  AUTO_CLOSED: {
    label: "Ditutup Otomatis (72 Jam)",
    Icon: Clock,
    className:
      "bg-green-50 text-green-800 ring-1 ring-green-300 [[data-theme=slate]_&]:bg-green-500/15 [[data-theme=slate]_&]:text-green-300 [[data-theme=slate]_&]:ring-green-500/30",
  },
  OPEN: {
    label: "Laporan Masuk",
    Icon: CircleDot,
    className:
      "bg-blue-100 text-blue-800 [[data-theme=slate]_&]:bg-blue-500/15 [[data-theme=slate]_&]:text-blue-300",
  },
  IN_PROGRESS: {
    label: "Sedang Ditangani",
    Icon: Wrench,
    className:
      "bg-yellow-100 text-yellow-900 [[data-theme=slate]_&]:bg-yellow-500/15 [[data-theme=slate]_&]:text-yellow-300",
  },
  PENDING_VALIDATION: {
    label: "Menunggu Cek Warga",
    Icon: Scale,
    className:
      "bg-orange-100 text-orange-900 [[data-theme=slate]_&]:bg-orange-500/15 [[data-theme=slate]_&]:text-orange-300",
  },
  ESCALATED: {
    label: "Eskalasi Pengawasan",
    Icon: Siren,
    className:
      "bg-red-900 text-red-50 [[data-theme=slate]_&]:bg-red-500/25 [[data-theme=slate]_&]:text-red-200",
  },
  OUT_OF_SCOPE: {
    label: "Kewenangan Instansi Lain",
    Icon: Ban,
    className:
      "bg-gray-200 text-gray-700 [[data-theme=slate]_&]:bg-gray-500/15 [[data-theme=slate]_&]:text-gray-300",
  },
  REJECTED_SPAM: {
    label: "Ditolak (Spam)",
    Icon: ShieldX,
    className:
      "bg-gray-700 text-gray-100 [[data-theme=slate]_&]:bg-gray-600/30 [[data-theme=slate]_&]:text-gray-200",
  },
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-surface-2 text-fg border border-line",
  brand: "bg-brand-soft text-brand",
  success: "bg-semantic-success-soft text-semantic-success border border-green-200",
  warning: "bg-semantic-warning-soft text-semantic-warning border border-amber-200",
  error: "bg-semantic-error-soft text-semantic-error border border-red-200",
  info: "bg-semantic-info-soft text-semantic-info border border-sky-200",
};

/**
 * Civic Tactical Badge — aligned with Figma "03 — Core Components (UI Kit)" Badges & Tags.
 * Supports Darurat, Menengah, Standar, Melewati Tenggat, Dibantah, Tuntas, all 10 ticket statuses,
 * and semantic tone variants. Always pairs icon + text label for status accessibility.
 */
export function Badge({
  status,
  variant = "neutral",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const preset = status ? STATUS_PRESETS[status] : undefined;
  const IconComp = preset?.Icon ?? (variant === "info" ? Info : null);

  const sizeClass =
    size === "sm"
      ? "px-2.5 py-0.5 text-[11px] leading-4 gap-1"
      : "px-3 py-1.5 text-[13px] leading-4 gap-1.5";

  const toneClass = preset
    ? preset.className
    : VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral;

  const fontClass = preset?.mono ? "font-mono font-bold text-[11px]" : "font-sans font-semibold";
  const labelText = children ?? preset?.label ?? status;

  return (
    <span
      role={preset ? "status" : undefined}
      aria-label={preset ? `Status: ${preset.label}` : undefined}
      className={[
        "inline-flex items-center rounded-full whitespace-nowrap leading-none",
        sizeClass,
        fontClass,
        toneClass,
        className,
      ].join(" ")}
      {...props}
    >
      {icon !== null &&
        (icon ??
          (IconComp ? (
            <IconComp className="size-3.5 shrink-0" aria-hidden="true" />
          ) : null))}
      <span>{labelText}</span>
    </span>
  );
}

export default Badge;
