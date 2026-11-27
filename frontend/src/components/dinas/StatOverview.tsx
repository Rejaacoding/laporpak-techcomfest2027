import { Card } from "../ui/index.js";
import type { KpiStatItem } from "../../lib/ticketMappers.ts";

export interface StatOverviewProps {
  stats: KpiStatItem[];
  className?: string;
}

const VALUE_TONE_CLASSES: Record<KpiStatItem["valueTone"], string> = {
  default: "text-fg",
  error: "text-semantic-error",
  purple: "text-purple-800",
  brand: "text-brand",
};

/**
 * 4 KPI Summary Cards — matched to Figma "Grid / KPI Summary Cards"
 * Padding 16px/18px, gap 14px, font-mono bold 28px/34px tabular-nums.
 */
export function StatOverview({ stats, className = "" }: StatOverviewProps) {
  return (
    <section
      aria-label="Ringkasan metrik antrean dinas"
      className={[
        "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5",
        className,
      ].join(" ")}
    >
      {stats.map((item) => (
        <Card
          key={item.id}
          density="none"
          className="px-[18px] py-4 flex flex-col gap-1"
        >
          <span className="font-sans text-xs leading-4 text-fg-muted">
            {item.label}
          </span>
          <span
            className={[
              "font-mono font-bold text-[28px] leading-[34px] tabular-nums",
              VALUE_TONE_CLASSES[item.valueTone] || VALUE_TONE_CLASSES.default,
            ].join(" ")}
          >
            {item.value}
          </span>
          <span className="font-sans text-xs leading-4 text-fg-muted">
            {item.meta}
          </span>
        </Card>
      ))}
    </section>
  );
}

export default StatOverview;
