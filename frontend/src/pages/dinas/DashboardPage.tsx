import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, RefreshCw, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { TopNavbar, DinasSidebar } from "../../components/layout/index.ts";
import type { DinasQueueFilterKey } from "../../components/layout/index.ts";
import {
  AlertBanners,
  DinasActionModal,
  StatOverview,
  TicketTable,
} from "../../components/dinas/index.ts";
import { Button, Input, Skeleton, useToast } from "../../components/ui/index.js";
import { useLiveSync } from "../../hooks/useLiveSync.ts";
import {
  executeDinasAction,
  getRapor,
  listDinasTickets,
  onJuryEvent,
} from "../../services/api.js";
import {
  buildDinasTicketActions,
  computeDinasQueueCounts,
  mapDinasTicketsToRows,
  mapRaporResponse,
} from "../../utils/ticketMappers.ts";
import type {
  ApiDinasTicket,
  DinasActionId,
  DinasTicketViewRow,
  KpiStatItem,
  RaporViewModel,
  TicketActionItem,
  TicketStatusCode,
} from "../../utils/ticketMappers.ts";
import { TICKET_STATUSES } from "../../constants/designTokens.js";

type RegionFilter = "ALL" | "Surabaya" | "Sidoarjo";

const REGION_CYCLE: RegionFilter[] = ["ALL", "Surabaya", "Sidoarjo"];
const VALID_STATUS_FILTERS: DinasQueueFilterKey[] = [
  "ALL",
  "OVERDUE",
  "DISPUTED",
  "ESCALATED",
  "PENDING_VALIDATION",
  "CLOSED",
];

/**
 * Dashboard Dinas (/dinas) — live queue, alerts, KPI and 8 mutation actions.
 */
export function DinasDashboardPage() {
  const { user, accessToken, isJuryMode } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = searchParams.get("status") as DinasQueueFilterKey | null;
  const [rawTickets, setRawTickets] = useState<ApiDinasTicket[]>([]);
  const [rapor, setRapor] = useState<RaporViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DinasQueueFilterKey>(
    initialStatus && VALID_STATUS_FILTERS.includes(initialStatus)
      ? initialStatus
      : "ALL"
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("ALL");
  const [selectedAction, setSelectedAction] = useState<{
    ticket: DinasTicketViewRow;
    action: TicketActionItem;
  } | null>(null);

  const loadData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!user) return;
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const [ticketPayload, raporPayload] = await Promise.all([
          listDinasTickets({}, accessToken),
          getRapor().catch(() => null),
        ]);
        const list = Array.isArray(ticketPayload)
          ? ticketPayload
          : ticketPayload?.tickets || [];
        setRawTickets(list);
        if (raporPayload) setRapor(mapRaporResponse(raporPayload));
      } catch (err) {
        if (!silent) setError(err);
        showToast({ type: "error", error: err });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, accessToken, showToast]
  );

  const { nowMs, syncLabel, markSynced } = useLiveSync({
    onRefresh: () => loadData({ silent: true }),
    intervalMs: 25_000,
    enabled: Boolean(user),
    realtimeTable: "Ticket",
  });

  useEffect(() => {
    if (!user) return;
    loadData().then(markSynced).catch(() => {});
  }, [user, loadData]);

  useEffect(
    () => onJuryEvent("reset", () => loadData({ silent: true }).then(markSynced)),
    [loadData]
  );

  const rows = useMemo(
    () => mapDinasTicketsToRows(rawTickets, nowMs),
    [rawTickets, nowMs]
  );

  const counts = useMemo(() => computeDinasQueueCounts(rows), [rows]);

  const handleFilterChange = useCallback(
    (next: DinasQueueFilterKey) => {
      setActiveFilter(next);
      const params = new URLSearchParams(searchParams);
      if (next === "ALL") params.delete("status");
      else params.set("status", next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((ticket) => {
      if (activeFilter === "CLOSED") {
        if (ticket.status !== "CLOSED" && ticket.status !== "AUTO_CLOSED") return false;
      } else if (activeFilter !== "ALL" && ticket.status !== activeFilter) {
        return false;
      }
      if (regionFilter !== "ALL" && ticket.region !== regionFilter) return false;
      if (!query) return true;
      return (
        ticket.displayCode.toLowerCase().includes(query) ||
        ticket.code.toLowerCase().includes(query) ||
        ticket.categoryTitle.toLowerCase().includes(query) ||
        ticket.location.toLowerCase().includes(query)
      );
    });
  }, [rows, activeFilter, regionFilter, searchQuery]);

  const disputedTicket = useMemo(
    () => rows.find((ticket) => ticket.status === "DISPUTED") || null,
    [rows]
  );
  const escalatedTicket = useMemo(
    () => rows.find((ticket) => ticket.status === "ESCALATED") || null,
    [rows]
  );

  const activeRows = useMemo(
    () => rows.filter((ticket) => !TICKET_STATUSES[ticket.status]?.terminal),
    [rows]
  );

  const kpiStats: KpiStatItem[] = useMemo(() => {
    const tierCounts = { DARURAT: 0, MENENGAH: 0, STANDAR: 0 };
    for (const ticket of activeRows) {
      tierCounts[ticket.tier] += 1;
    }
    const overdueCount = rows.filter((ticket) => ticket.status === "OVERDUE").length;
    const disputedCount = rows.filter((ticket) => ticket.status === "DISPUTED").length;
    const escalatedCount = rows.filter((ticket) => ticket.status === "ESCALATED").length;
    const myDepartment = rapor?.departments.find(
      (department) => department.id === user?.departmentId
    );
    const score = myDepartment?.score ?? 80;
    return [
      {
        id: "active",
        label: "Tiket Aktif",
        value: String(activeRows.length),
        meta: `${tierCounts.DARURAT} Darurat · ${tierCounts.MENENGAH} Menengah · ${tierCounts.STANDAR} Standar`,
        valueTone: "default",
      },
      {
        id: "overdue",
        label: "Melewati Tenggat",
        value: String(overdueCount),
        meta: "Penalti aktif -3 / -6 poin per tiket",
        valueTone: "error",
      },
      {
        id: "disputed-escalated",
        label: "Dibantah & Eskalasi",
        value: `${disputedCount} / ${escalatedCount}`,
        meta: `${disputedCount} Dibantah Warga · ${escalatedCount} Eskalasi Berita Acara`,
        valueTone: "purple",
      },
      {
        id: "integrity",
        label: "Skor Integritas Dinas",
        value: String(score),
        meta: `Kepatuhan SLA ${myDepartment?.slaCompliance || "100.0%"} · Tepat waktu +2 poin`,
        valueTone: "brand",
      },
    ];
  }, [activeRows, rows, rapor, user?.departmentId]);

  const handleCycleRegion = () => {
    const index = REGION_CYCLE.indexOf(regionFilter);
    setRegionFilter(REGION_CYCLE[(index + 1) % REGION_CYCLE.length]);
  };

  const applyServerActionPatch = useCallback(
    (
      ticketId: string,
      actionId: DinasActionId,
      serverData?: Record<string, unknown> | null
    ) => {
      setRawTickets((prev) => {
        if (actionId === "transfer") {
          return prev.filter((item) => item.id !== ticketId);
        }
        return prev.map((item) => {
          if (item.id !== ticketId) return item;
          const nextStatus =
            (serverData?.status as TicketStatusCode) || item.status;
          return {
            ...item,
            status: nextStatus,
            slaDeadline:
              (serverData?.slaDeadline as string) || item.slaDeadline,
            appealUsed: actionId === "counter-dispute" ? true : item.appealUsed,
            isFastResolveAnomaly:
              typeof serverData?.isFastResolveAnomaly === "boolean"
                ? serverData.isFastResolveAnomaly
                : item.isFastResolveAnomaly,
          };
        });
      });
    },
    []
  );

  const handleResetFilters = () => {
    handleFilterChange("ALL");
    setRegionFilter("ALL");
    setSearchQuery("");
  };

  const executeQuickProcess = async (ticket: DinasTicketViewRow) => {
    const lockKey = `${ticket.id}:process`;
    if (busyActionKey) return;
    setBusyActionKey(lockKey);
    try {
      const serverData = await executeDinasAction(
        ticket.id,
        "process",
        {},
        accessToken
      );
      applyServerActionPatch(ticket.id, "process", serverData);
      showToast({
        type: "success",
        title: "Pengerjaan dimulai",
        message: `${ticket.displayCode} kini berstatus Sedang Ditangani dan tercatat di segel audit.`,
      });
      void loadData({ silent: true });
    } catch (err) {
      showToast({ type: "error", error: err });
    } finally {
      setBusyActionKey(null);
    }
  };

  const handleTicketAction = (
    ticket: DinasTicketViewRow,
    action: TicketActionItem
  ) => {
    if (action.disabled || busyActionKey) return;
    if (action.id === "process") {
      void executeQuickProcess(ticket);
      return;
    }
    setSelectedAction({ ticket, action });
  };

  const openActionForTicket = (ticketId: string, actionId: DinasActionId) => {
    const ticket = rows.find((row) => row.id === ticketId);
    const action =
      ticket?.actions.find((item) => item.id === actionId) ||
      (ticket
        ? buildDinasTicketActions(ticket, nowMs).find((item) => item.id === actionId)
        : undefined);
    if (!ticket || !action) {
      showToast({
        type: "warning",
        title: "Aksi belum tersedia",
        message: "Muat ulang antrean untuk memperbarui status tiket ini.",
      });
      return;
    }
    setSelectedAction({ ticket, action });
  };

  const departmentName = user?.departmentName || "Dinas PU Bina Marga & Pematusan";
  const profileLabel = user?.departmentShortName
    ? `Admin · ${user.departmentShortName}`
    : "Admin · Dinas";

  if (loading && rawTickets.length === 0) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col">
        <TopNavbar profileLabel={profileLabel} />
        <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
          <div className="w-full lg:w-64 shrink-0 border-b lg:border-r border-line p-[18px]">
            <Skeleton className="h-40 w-full" />
          </div>
          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
            <Skeleton className="h-8 w-72" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-72 w-full" />
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col">
        <TopNavbar profileLabel={profileLabel} />
        <main className="max-w-lg w-full mx-auto px-4 py-16">
          <div className="rounded-2xl border border-line bg-surface p-6 text-center flex flex-col items-center gap-3">
            <h1 className="font-head font-bold text-xl text-fg">
              Antrean dinas belum bisa dimuat
            </h1>
            <p className="font-sans text-sm text-fg-muted">
              Periksa koneksi lalu muat ulang data. Sesi dan filter tetap aman.
            </p>
            <Button variant="primary" size="md" onClick={() => void loadData()}>
              Muat Ulang
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <TopNavbar profileLabel={profileLabel} />

      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        <DinasSidebar
          departmentName={departmentName}
          regionLabel="Kota Surabaya & Kab. Sidoarjo"
          isVerifiedPartner
          integrityScore={
            rapor?.departments.find((department) => department.id === user?.departmentId)
              ?.score ?? 80
          }
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          counts={counts}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-7 flex flex-col gap-5">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="font-head font-bold text-2xl md:text-[30px] md:leading-9 text-fg">
                Meja Kerja Antrean Dinas
              </h1>
              <p className="font-sans text-sm leading-5 text-fg-muted">
                {rows.length} tiket · {counts.OVERDUE} melewati tenggat ·{" "}
                {counts.DISPUTED} dibantah · {counts.ESCALATED} eskalasi ·{" "}
                <span className="font-mono text-xs text-brand">Sinkron {syncLabel}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
              <Input
                density="dinas"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari lokasi atau #ID tiket..."
                aria-label="Cari lokasi atau ID tiket"
                leftIcon={<Search className="size-4" />}
                wrapperClassName="w-full sm:w-[260px]"
              />

              <Button
                variant="secondary"
                size="sm"
                onClick={handleCycleRegion}
                leftIcon={<Filter className="size-3.5" />}
              >
                {regionFilter === "ALL"
                  ? "Filter Wilayah"
                  : `Wilayah: ${regionFilter}`}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                loading={refreshing}
                onClick={() => void loadData({ silent: true })}
                leftIcon={<RefreshCw className="size-3.5" />}
              >
                Segarkan
              </Button>
            </div>
          </header>

          <StatOverview stats={kpiStats} />

          <AlertBanners
            disputedTicket={disputedTicket}
            escalatedTicket={escalatedTicket}
            onProcessRework={(ticketId) =>
              openActionForTicket(ticketId, "reprocess-disputed")
            }
            onAppealEvidence={(ticketId) =>
              openActionForTicket(ticketId, "counter-dispute")
            }
            onUploadEscalation={(ticketId) =>
              openActionForTicket(ticketId, "resolve-escalated")
            }
          />

          <TicketTable
            tickets={filteredTickets}
            activeTab={activeFilter}
            counts={counts}
            busyActionKey={busyActionKey}
            onTabChange={handleFilterChange}
            onAction={handleTicketAction}
            onResetFilters={handleResetFilters}
          />
        </main>
      </div>

      <DinasActionModal
        open={Boolean(selectedAction)}
        ticket={selectedAction?.ticket ?? null}
        action={selectedAction?.action ?? null}
        currentDepartmentId={user?.departmentId}
        accessToken={accessToken}
        isJuryMode={isJuryMode}
        onClose={() => setSelectedAction(null)}
        onSuccess={(serverData) => {
          if (selectedAction) {
            applyServerActionPatch(
              selectedAction.ticket.id,
              selectedAction.action.id,
              serverData
            );
          }
          void loadData({ silent: true });
        }}
      />
    </div>
  );
}

export default DinasDashboardPage;
