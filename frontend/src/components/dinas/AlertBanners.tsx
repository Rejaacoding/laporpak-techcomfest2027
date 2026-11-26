import { Badge, Button, Card } from "../ui/index.js";
import { DINAS_ALERTS } from "../../data/mockTickets.ts";

export interface AlertBannersProps {
  onProcessRework?: (ticketId: string) => void;
  onAppealEvidence?: (ticketId: string) => void;
  onUploadEscalation?: (ticketId: string) => void;
  className?: string;
}

/**
 * Priority Action Alerts — matched to Figma "Grid / Priority Action Alerts"
 * Displays DISPUTED 24h countdown banner (#FAF5FF / #D8B4FE) and
 * ESCALATED Berita Acara banner (#FEF2F2 / #FECACA).
 */
export function AlertBanners({
  onProcessRework,
  onAppealEvidence,
  onUploadEscalation,
  className = "",
}: AlertBannersProps) {
  const { disputed, escalated } = DINAS_ALERTS;

  return (
    <section
      aria-label="Peringatan prioritas tindak lanjut"
      className={[
        "grid grid-cols-1 xl:grid-cols-2 gap-3.5",
        className,
      ].join(" ")}
    >
      {/* Disputed 24h Auto-Rework Banner */}
      <Card
        density="none"
        className="!bg-purple-50 !border-purple-300 !shadow-none px-[18px] py-4 flex flex-col justify-between gap-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge status="DISPUTED" />
          <span className="font-mono font-bold text-xs leading-4 text-purple-800 tabular-nums">
            {disputed.countdownText}
          </span>
        </div>

        <p className="font-sans text-sm leading-5 text-fg">
          {disputed.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onProcessRework?.(disputed.ticketId)}
          >
            Proses Ulang
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAppealEvidence?.(disputed.ticketId)}
          >
            Ajukan Banding Bukti (1×)
          </Button>
        </div>
      </Card>

      {/* Escalated Berita Acara Banner */}
      <Card
        density="none"
        className="!bg-red-50 !border-red-200 !shadow-none px-[18px] py-4 flex flex-col justify-between gap-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge status="ESCALATED" />
          <span className="font-mono font-bold text-xs leading-4 text-red-800 tabular-nums">
            {escalated.penaltyText}
          </span>
        </div>

        <p className="font-sans text-sm leading-5 text-fg">
          {escalated.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            variant="danger"
            size="sm"
            onClick={() => onUploadEscalation?.(escalated.ticketId)}
          >
            Unggah Berita Acara &amp; Foto Live
          </Button>
        </div>
      </Card>
    </section>
  );
}

export default AlertBanners;
