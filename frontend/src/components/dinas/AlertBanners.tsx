import { Badge, Button, Card } from "../ui/index.js";
import { formatSlaRemaining } from "../../utils/ticketMappers.ts";
import type { DinasTicketViewRow } from "../../utils/ticketMappers.ts";

export interface AlertBannersProps {
  disputedTicket?: DinasTicketViewRow | null;
  escalatedTicket?: DinasTicketViewRow | null;
  onProcessRework?: (ticketId: string) => void;
  onAppealEvidence?: (ticketId: string) => void;
  onUploadEscalation?: (ticketId: string) => void;
  className?: string;
}

/**
 * Priority Action Alerts — live DISPUTED 24h countdown and ESCALATED Berita Acara rows.
 */
export function AlertBanners({
  disputedTicket = null,
  escalatedTicket = null,
  onProcessRework,
  onAppealEvidence,
  onUploadEscalation,
  className = "",
}: AlertBannersProps) {
  if (!disputedTicket && !escalatedTicket) return null;

  const both = Boolean(disputedTicket && escalatedTicket);
  const disputedSla = disputedTicket
    ? formatSlaRemaining(disputedTicket)
    : null;
  const disputedCountdown = disputedSla?.text.startsWith("Jeda ")
    ? disputedSla.text.slice("Jeda ".length)
    : "00:00:00";

  return (
    <section
      aria-label="Peringatan prioritas tindak lanjut"
      className={[
        "grid grid-cols-1 gap-3.5",
        both ? "xl:grid-cols-2" : "",
        className,
      ].join(" ")}
    >
      {disputedTicket && (
        <Card
          density="none"
          className="!bg-purple-50 !border-purple-300 !shadow-none px-[18px] py-4 flex flex-col justify-between gap-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge status="DISPUTED" />
            <span className="font-mono font-bold text-xs leading-4 text-purple-800 tabular-nums">
              Batas respons: {disputedCountdown}
            </span>
          </div>

          <p className="font-sans text-sm leading-5 text-fg">
            {disputedTicket.displayCode} · {disputedTicket.categoryTitle} —{" "}
            {disputedTicket.location}. Warga mengunggah foto bantahan. Jika diam
            &gt;24 jam, sistem otomatis memaksa Perbaikan Ulang.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onProcessRework?.(disputedTicket.id)}
            >
              Proses Ulang
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disputedTicket.appealUsed}
              disabledReason={
                disputedTicket.appealUsed
                  ? "Banding bukti sudah dipakai 1 kali untuk laporan ini."
                  : undefined
              }
              onClick={() => onAppealEvidence?.(disputedTicket.id)}
            >
              Ajukan Banding Bukti (1×)
            </Button>
          </div>
        </Card>
      )}

      {escalatedTicket && (
        <Card
          density="none"
          className="!bg-red-50 !border-red-200 !shadow-none px-[18px] py-4 flex flex-col justify-between gap-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge status="ESCALATED" />
            <span className="font-mono font-bold text-xs leading-4 text-red-800 tabular-nums">
              Penalti permanen -5 poin
            </span>
          </div>

          <p className="font-sans text-sm leading-5 text-fg">
            {escalatedTicket.displayCode} · {escalatedTicket.categoryTitle} —{" "}
            {escalatedTicket.location}. Bantahan putaran ke-2 sah. Tombol Selesai
            terkunci hingga Berita Acara (PDF/JPG ≤5 MB) dan Foto Live (≤75 m)
            diunggah.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onUploadEscalation?.(escalatedTicket.id)}
            >
              Unggah Berita Acara &amp; Foto Live
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}

export default AlertBanners;
