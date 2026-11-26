import { Badge, Button, Card } from "../ui/index.js";

export interface AlertTicketSummary {
  id: string;
  code: string;
  title: string;
  countdownText?: string;
  appealUsed?: boolean;
}

export interface AlertBannersProps {
  disputedTicket?: AlertTicketSummary | null;
  escalatedTicket?: AlertTicketSummary | null;
  onProcessRework?: (ticketId: string) => void;
  onAppealEvidence?: (ticketId: string) => void;
  onUploadEscalation?: (ticketId: string) => void;
  className?: string;
}

/**
 * Priority Action Alerts for /dinas — driven 100% by real DISPUTED & ESCALATED tickets.
 */
export function AlertBanners({
  disputedTicket,
  escalatedTicket,
  onProcessRework,
  onAppealEvidence,
  onUploadEscalation,
  className = "",
}: AlertBannersProps) {
  if (!disputedTicket && !escalatedTicket) return null;

  return (
    <section
      aria-label="Peringatan prioritas tindak lanjut"
      className={[
        "grid grid-cols-1 gap-3.5",
        disputedTicket && escalatedTicket ? "xl:grid-cols-2" : "",
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
              {disputedTicket.countdownText || "Wajib respons ≤ 24 jam"}
            </span>
          </div>

          <p className="font-sans text-sm leading-5 text-fg">
            <strong className="font-mono text-xs mr-1.5">
              {disputedTicket.code}
            </strong>
            {disputedTicket.title} — dibantah warga. Pilih kerjakan ulang (+24
            jam) atau ajukan banding bukti foto sudut baru.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onProcessRework?.(disputedTicket.id)}
            >
              Proses Perbaikan Ulang
            </Button>
            {!disputedTicket.appealUsed && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAppealEvidence?.(disputedTicket.id)}
              >
                Ajukan Banding Bukti (1×)
              </Button>
            )}
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
              Penalti -5 poin permanen
            </span>
          </div>

          <p className="font-sans text-sm leading-5 text-fg">
            <strong className="font-mono text-xs mr-1.5">
              {escalatedTicket.code}
            </strong>
            {escalatedTicket.title} — wajib unggah Berita Acara (PDF/JPG/PNG &le;5
            MB) dan foto lapangan langsung (&le;75 m) untuk menutup tiket.
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
