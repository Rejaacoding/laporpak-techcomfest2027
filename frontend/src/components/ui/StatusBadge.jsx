import { TICKET_STATUSES } from "../../constants/designTokens.js";

/**
 * 10-Status Badge with mandatory Lucide icon + Indonesian label (docs/design.md §3 & §7).
 * Never conveys status by color alone.
 */
export function StatusBadge({ status, size = "md", className = "" }) {
  const config = TICKET_STATUSES[status] || TICKET_STATUSES.OPEN;
  const Icon = config.Icon;

  const sizeClass =
    size === "sm"
      ? "px-2.5 py-0.5 text-xs gap-1"
      : "px-3 py-1 text-xs font-semibold gap-1.5";

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={[
        "inline-flex items-center rounded-full whitespace-nowrap font-medium leading-none",
        sizeClass,
        config.badgeClass,
        className,
      ].join(" ")}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
