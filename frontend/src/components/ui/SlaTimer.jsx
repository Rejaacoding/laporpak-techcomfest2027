import { useEffect, useState } from "react";
import { AlarmClock, Clock, Pause } from "lucide-react";
import { SLA_TIERS, TICKET_STATUSES } from "../../constants/designTokens.js";

function pad2(n) {
  return String(Math.floor(n)).padStart(2, "0");
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} hari ${remHours} jam`;
  }
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function formatOverdue(overdueMs) {
  const totalMinutes = Math.max(1, Math.floor(overdueMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `Terlambat +${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * Public SLA Countdown (docs/design.md §6.4)
 * - Updates every 1s
 * - >24h: "X hari Y jam", <=24h: "HH:MM:SS" (font-mono tabular-nums)
 * - PENDING_VALIDATION: paused state ("SLA dijeda")
 * - OVERDUE / <=0: "Terlambat +HH:MM" in bold red
 */
export function SlaTimer({
  deadlineAt,
  slaHours,
  status,
  tier,
  paused = false,
  showTier = false,
  className = "",
}) {
  const [now, setNow] = useState(() => Date.now());
  const isPaused = paused || status === "PENDING_VALIDATION";
  const isTerminal = Boolean(status && TICKET_STATUSES[status]?.terminal);

  useEffect(() => {
    if (isPaused || isTerminal || !deadlineAt) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, isTerminal, deadlineAt]);

  const tierConfig = tier ? SLA_TIERS[tier] : null;

  if (isTerminal) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {showTier && tierConfig && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tierConfig.chipClass}`}
          >
            {tierConfig.label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 font-mono text-sm tabular-nums text-fg-muted">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <span>Selesai</span>
        </span>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {showTier && tierConfig && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tierConfig.chipClass}`}
          >
            {tierConfig.label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 font-mono text-sm tabular-nums text-fg-muted">
          <Pause className="size-4 shrink-0" aria-hidden="true" />
          <span>SLA dijeda</span>
        </span>
      </div>
    );
  }

  const deadlineMs = deadlineAt ? new Date(deadlineAt).getTime() : 0;
  const remainingMs = deadlineMs - now;
  const totalMs = (slaHours || tierConfig?.hours || 72) * 3600 * 1000;
  const ratio = totalMs > 0 ? remainingMs / totalMs : 0;

  let toneClass = "text-fg";
  let displayText = formatRemaining(remainingMs);
  const isOverdue = status === "OVERDUE" || remainingMs <= 0;

  if (isOverdue) {
    toneClass = "text-red-700 [[data-theme=slate]_&]:text-red-400 font-bold";
    displayText = formatOverdue(Math.max(0, now - deadlineMs));
  } else if (ratio < 0.25) {
    toneClass = "text-red-700 [[data-theme=slate]_&]:text-red-300";
  } else if (ratio <= 0.5) {
    toneClass = "text-amber-700 [[data-theme=slate]_&]:text-amber-300";
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {showTier && tierConfig && (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tierConfig.chipClass}`}
        >
          {tierConfig.label}
        </span>
      )}
      <span
        className={`inline-flex items-center gap-1 font-mono text-sm tabular-nums ${toneClass}`}
      >
        {isOverdue ? (
          <AlarmClock className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <Clock className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span>{displayText}</span>
      </span>
    </div>
  );
}
