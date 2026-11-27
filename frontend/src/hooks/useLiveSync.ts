import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase.ts";

export interface UseLiveSyncOptions {
  /** Silent refresh callback executed on poll, tab focus, or realtime DB event */
  onRefresh: () => void | Promise<void>;
  /** Poll interval in ms while tab is visible (default 25 s; matches Redis TTL safely) */
  intervalMs?: number;
  /** Clock tick interval in ms for live SLA countdowns (default 30 s) */
  clockTickMs?: number;
  /** Disable polling/subscription when page is idle or unauthenticated */
  enabled?: boolean;
  /** Subscribe to Supabase Realtime changes on Ticket table when configured */
  realtimeTable?: "Ticket" | "DepartmentRating" | null;
}

export function formatSyncClockWib(timestampMs: number | null): string {
  if (!timestampMs) return "Memuat...";
  return `${new Date(timestampMs).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

/**
 * Lightweight live-sync hook:
 * - Ticks `nowMs` every 30 s for live SLA and 24h DISPUTED countdowns
 * - Silently re-fetches on tab focus (debounced 8 s) and 25 s visible-tab interval
 * - Listens to Supabase Realtime postgres_changes when enabled (graceful fallback)
 */
export function useLiveSync({
  onRefresh,
  intervalMs = 25_000,
  clockTickMs = 30_000,
  enabled = true,
  realtimeTable = "Ticket",
}: UseLiveSyncOptions) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(() => Date.now());
  const refreshRef = useRef(onRefresh);
  const lastTriggerRef = useRef(Date.now());

  refreshRef.current = onRefresh;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), clockTickMs);
    return () => window.clearInterval(timer);
  }, [clockTickMs]);

  useEffect(() => {
    if (!enabled) return undefined;

    const triggerRefresh = (minGapMs = 5_000) => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastTriggerRef.current < minGapMs) return;
      lastTriggerRef.current = now;
      Promise.resolve(refreshRef.current())
        .then(() => {
          setLastSyncedAt(Date.now());
          setNowMs(Date.now());
        })
        .catch(() => {});
    };

    const pollTimer = window.setInterval(() => {
      triggerRefresh(Math.max(5_000, intervalMs - 2_000));
    }, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerRefresh(8_000);
      }
    };

    const handleFocus = () => triggerRefresh(8_000);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    if (supabase && realtimeTable) {
      try {
        channel = supabase
          .channel(`laporpak-live-${realtimeTable}-${Math.random().toString(36).slice(2, 7)}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: realtimeTable },
            () => {
              triggerRefresh(2_500);
            }
          )
          .subscribe();
      } catch {
        // Realtime is best-effort; interval + focus sync remains active.
      }
    }

    return () => {
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      if (channel && supabase) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [enabled, intervalMs, realtimeTable]);

  const markSynced = useCallback(() => {
    const ts = Date.now();
    lastTriggerRef.current = ts;
    setLastSyncedAt(ts);
    setNowMs(ts);
  }, []);

  return {
    nowMs,
    lastSyncedAt,
    syncLabel: formatSyncClockWib(lastSyncedAt),
    markSynced,
  };
}

export default useLiveSync;
