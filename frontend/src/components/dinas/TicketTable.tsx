import { Link } from "react-router-dom";
import { AlertTriangle, Clock, MapPin, ThumbsUp } from "lucide-react";
import { Badge, Button, Card } from "../ui/index.js";
import type { DinasQueueCounts, DinasQueueFilterKey } from "../layout/DinasSidebar.tsx";
import type {
  DinasTicketViewRow,
  TicketActionItem,
} from "../../utils/ticketMappers.ts";

export interface TicketTableProps {
  tickets: DinasTicketViewRow[];
  activeTab: DinasQueueFilterKey;
  counts?: Partial<DinasQueueCounts>;
  busyActionKey?: string | null;
  onTabChange: (tab: DinasQueueFilterKey) => void;
  onAction?: (ticket: DinasTicketViewRow, action: TicketActionItem) => void;
  onResetFilters?: () => void;
  className?: string;
}

function summarizeDisabledReasons(actions: TicketActionItem[]): string | null {
  const locked = actions.filter((a) => a.disabled && a.disabledReason);
  if (locked.length === 0) return null;
  const uniqueReasons = [...new Set(locked.map((a) => a.disabledReason))];
  const names = locked.map((a) => a.label).join(" / ");
  return `${names} terkunci: ${uniqueReasons[0]}`;
}

const TABS: Array<{
  key: DinasQueueFilterKey;
  label: string;
  countClass: string;
}> = [
  { key: "ALL", label: "Semua Antrean", countClass: "bg-brand-soft text-brand" },
  { key: "OVERDUE", label: "Melewati Tenggat", countClass: "bg-red-100 text-red-800" },
  { key: "DISPUTED", label: "Dibantah Warga", countClass: "bg-purple-100 text-purple-800" },
  { key: "ESCALATED", label: "Eskalasi", countClass: "bg-red-900 text-red-50" },
  {
    key: "PENDING_VALIDATION",
    label: "Menunggu Cek Warga",
    countClass: "bg-orange-100 text-orange-900",
  },
  { key: "CLOSED", label: "Tuntas Terverifikasi", countClass: "bg-green-100 text-green-800" },
];

const SLA_TONE_CLASSES: Record<DinasTicketViewRow["slaTone"], string> = {
  overdue: "text-semantic-error",
  disputed: "text-purple-800",
  warning: "text-amber-700",
  normal: "text-fg",
  muted: "text-fg-muted",
};

/**
 * Ticket Queue Tabs + Priority Table — live API rows and counts.
 * Desktop: dense table; mobile: compact card stack (docs/design.md §6.9).
 */
export function TicketTable({
  tickets,
  activeTab,
  counts = {},
  busyActionKey = null,
  onTabChange,
  onAction,
  onResetFilters,
  className = "",
}: TicketTableProps) {
  return (
    <section
      aria-label="Daftar antrean tiket prioritas dinas"
      className={["flex flex-col gap-5", className].join(" ")}
    >
      <div
        role="tablist"
        aria-label="Filter status antrean"
        className="flex items-center gap-7 border-b border-line px-1 overflow-x-auto"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const count = counts?.[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.key)}
              className={[
                "inline-flex items-center gap-2 py-3 px-1 shrink-0 whitespace-nowrap cursor-pointer",
                "border-b-[3px] -mb-px font-head text-sm leading-5",
                "transition duration-150 ease-out motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                active
                  ? "border-brand text-brand font-semibold"
                  : "border-transparent text-fg-muted font-medium hover:text-fg",
              ].join(" ")}
            >
              <span>{tab.label}</span>
              <span
                className={[
                  "inline-flex items-center justify-center rounded-full px-2 py-0.5",
                  "font-mono font-bold text-[11px] leading-[14px] tabular-nums",
                  tab.countClass,
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tickets.length === 0 ? (
        <Card className="text-center py-10 flex flex-col items-center gap-3">
          <p className="font-head font-semibold text-base text-fg">
            Tidak ada tiket pada filter atau pencarian ini
          </p>
          <p className="font-sans text-sm text-fg-muted max-w-md">
            Coba ubah kata kunci pencarian alamat atau kembali ke tampilan semua
            antrean prioritas dinas.
          </p>
          {onResetFilters && (
            <Button variant="secondary" size="sm" onClick={onResetFilters}>
              Reset Filter Antrean
            </Button>
          )}
        </Card>
      ) : (
        <>
          <Card density="none" className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-2 border-b border-line">
                    <th className="py-3 pl-5 pr-3.5 w-[190px] font-mono font-bold text-[11px] leading-4 text-fg-muted tracking-wide">
                      STATUS
                    </th>
                    <th className="py-3 px-3.5 font-mono font-bold text-[11px] leading-4 text-fg-muted tracking-wide">
                      KATEGORI &amp; LOKASI
                    </th>
                    <th className="py-3 px-3.5 w-[175px] font-mono font-bold text-[11px] leading-4 text-fg-muted tracking-wide">
                      SLA TIMER
                    </th>
                    <th className="py-3 px-3.5 w-[100px] font-mono font-bold text-[11px] leading-4 text-fg-muted tracking-wide">
                      DUKUNGAN
                    </th>
                    <th className="py-3 pl-3.5 pr-5 w-[310px] font-mono font-bold text-[11px] leading-4 text-fg-muted tracking-wide">
                      AKSI DINAS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tickets.map((ticket, index) => {
                    const isOverdue = ticket.status === "OVERDUE";
                    const rowKey = ticket.id;
                    const isRowBusy = Boolean(
                      busyActionKey && busyActionKey.startsWith(`${rowKey}:`)
                    );
                    const disabledNote = summarizeDisabledReasons(ticket.actions);
                    return (
                      <tr
                        key={ticket.id}
                        className={[
                          "transition-colors duration-150 hover:bg-surface-2/50",
                          isOverdue
                            ? "bg-red-50/40 border-l-4 border-l-red-600"
                            : index % 2 === 1
                              ? "bg-bg/60"
                              : "bg-surface",
                        ].join(" ")}
                      >
                        <td className="py-3 pl-5 pr-3.5 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            <Badge status={ticket.status} />
                            <Link
                              to={`/tiket/${rowKey}`}
                              className="font-mono font-medium text-[11px] leading-[14px] text-brand hover:underline"
                            >
                              {ticket.displayCode}
                            </Link>
                            {ticket.isFastResolveAnomaly && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                                Selesai &lt;10m
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 align-middle">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-head font-semibold text-sm leading-5 text-fg">
                                {ticket.categoryTitle}
                              </span>
                              <Badge status={ticket.tier} size="sm" />
                            </div>
                            <div className="flex items-start gap-1.5 text-fg-muted">
                              <MapPin
                                className="size-3.5 mt-0.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="font-sans text-sm leading-5">
                                {ticket.location}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 align-middle">
                          <span
                            className={[
                              "inline-flex items-center gap-1.5 font-mono font-bold text-xs leading-4 tabular-nums whitespace-nowrap",
                              SLA_TONE_CLASSES[ticket.slaTone],
                            ].join(" ")}
                          >
                            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                            <span>{ticket.slaText}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3.5 align-middle">
                          <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[13px] leading-[18px] text-fg tabular-nums">
                            <ThumbsUp
                              className="size-3.5 text-brand shrink-0"
                              aria-hidden="true"
                            />
                            <span>{ticket.supportCount}</span>
                          </span>
                        </td>

                        <td className="py-3 pl-3.5 pr-5 align-middle">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {ticket.actions.length === 0 ? (
                                <span className="text-xs text-fg-muted">
                                  Tidak ada aksi lanjutan
                                </span>
                              ) : (
                                ticket.actions.map((action) => {
                                  const isActionLoading =
                                    busyActionKey === `${rowKey}:${action.id}`;
                                  return (
                                    <Button
                                      key={action.id}
                                      variant={action.variant}
                                      size="sm"
                                      loading={isActionLoading}
                                      disabled={action.disabled || isRowBusy}
                                      title={action.disabledReason}
                                      onClick={() => onAction?.(ticket, action)}
                                    >
                                      {isActionLoading
                                        ? "Memproses..."
                                        : action.label}
                                    </Button>
                                  );
                                })
                              )}
                            </div>
                            {disabledNote && (
                              <p className="text-[11px] leading-4 text-fg-muted">
                                {disabledNote}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col gap-2.5 md:hidden">
            {tickets.map((ticket) => {
              const isOverdue = ticket.status === "OVERDUE";
              const rowKey = ticket.id;
              const isRowBusy = Boolean(
                busyActionKey && busyActionKey.startsWith(`${rowKey}:`)
              );
              const disabledNote = summarizeDisabledReasons(ticket.actions);
              return (
                <Card
                  key={ticket.id}
                  density="dinas"
                  className={[
                    "flex flex-col gap-2.5",
                    isOverdue ? "border-l-4 border-l-red-600 !bg-red-50/40" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge status={ticket.status} size="sm" />
                      {ticket.isFastResolveAnomaly && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                          &lt;10m
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/tiket/${rowKey}`}
                      className="font-mono font-medium text-[11px] text-brand hover:underline"
                    >
                      {ticket.displayCode}
                    </Link>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-head font-semibold text-sm text-fg">
                        {ticket.categoryTitle}
                      </h3>
                      <Badge status={ticket.tier} size="sm" />
                    </div>
                    <p className="inline-flex items-start gap-1.5 text-xs text-fg-muted">
                      <MapPin
                        className="size-3.5 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{ticket.location}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
                    <span
                      className={[
                        "inline-flex items-center gap-1 font-mono font-bold text-xs tabular-nums",
                        SLA_TONE_CLASSES[ticket.slaTone],
                      ].join(" ")}
                    >
                      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{ticket.slaText}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-fg tabular-nums">
                      <ThumbsUp
                        className="size-3.5 text-brand shrink-0"
                        aria-hidden="true"
                      />
                      <span>{ticket.supportCount}</span>
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ticket.actions.length === 0 ? (
                        <span className="text-xs text-fg-muted">
                          Tidak ada aksi lanjutan
                        </span>
                      ) : (
                        ticket.actions.map((action) => {
                          const isActionLoading =
                            busyActionKey === `${rowKey}:${action.id}`;
                          return (
                            <Button
                              key={action.id}
                              variant={action.variant}
                              size="sm"
                              loading={isActionLoading}
                              disabled={action.disabled || isRowBusy}
                              title={action.disabledReason}
                              onClick={() => onAction?.(ticket, action)}
                            >
                              {isActionLoading ? "Memproses..." : action.label}
                            </Button>
                          );
                        })
                      )}
                    </div>
                    {disabledNote && (
                      <p className="text-[11px] leading-4 text-fg-muted">
                        {disabledNote}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export default TicketTable;
