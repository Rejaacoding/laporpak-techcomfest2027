import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
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
import {
  getRapor,
  listDinasTickets,
  onJuryEvent,
} from "../../lib/api.js";
import {
  computeDinasQueueCounts,
  mapDinasTicketsToRows,
  mapRaporResponse,
} from "../../lib/ticketMappers.ts";
import type {
  DinasActionId,
  DinasTicketViewRow,
  KpiStatItem,
  RaporViewModel,
  TicketActionItem,
} from "../../lib/ticketMappers.ts";
import { TICKET_STATUSES } from "../../constants/designTokens.js";

type RegionFilter = "ALL" | "Surabaya" | "Sidoarjo";

const REGION_CYCLE: RegionFilter[] = ["ALL", "Surabaya", "Sidoarjo"];

/**
 * Dashboard Dinas (/dinas) — live queue, alerts, KPI and 8 mutation actions.
 */
export function DinasDashboardPage() {
  const { user, accessToken, isJuryMode } = useAuth();
  const { showToast } = useToast();

  const [rows, setRows] = useState<DinasTicketViewRow[]>([]);
  const [rapor, setRapor] = useState<RaporViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [activeFilter, setActiveFilter] = useState<DinasQueueFilterKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("ALL");
  const [selectedAction, setSelectedAction] = useState<{
    ticket: DinasTicketViewRow;
    action: TicketActionItem;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [ticketPayload, raporPayload] = await Promise.all([
        listDinasTickets({}, accessToken),
        getRapor(),
      ]);
      setRows(mapDinasTicketsToRows(ticketPayload));
      setRapor(mapRaporResponse(raporPayload));
    } catch (err) {
      setError(err);
      showToast({ type: "error", error: err });
    } finally {
      setLoading(false);
    }
  }, [user, accessToken, showToast]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, loadData]);

  useEffect(
    () => onJuryEvent("reset", () => loadData()),
    [loadData]
  );

  const counts = useMemo(() => computeDinasQueueCounts(rows), [rows]);

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((ticket) => {
      if (activeFilter !== "ALL" && ticket.status !== activeFilter) return false;
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

  const handleResetFilters = () => {
    setActiveFilter("ALL");
    setRegionFilter("ALL");
    setSearchQuery("");
  };

  const handleTicketAction = (
    ticket: DinasTicketViewRow,
    action: TicketActionItem
  ) => {
    if (action.disabled) return;
    setSelectedAction({ ticket, action });
  };

  const openActionForTicket = (ticketId: string, actionId: DinasActionId) => {
    const ticket = rows.find((row) => row.id === ticketId);
    const action = ticket?.actions.find((item) => item.id === actionId);
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

  if (loading) {
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
            <Button variant="primary" size="md" onClick={loadData}>
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
          onFilterChange={setActiveFilter}
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
                {counts.DISPUTED} dibantah · {counts.ESCALATED} eskalasi
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
            onTabChange={setActiveFilter}
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
        onSuccess={loadData}
      />
    </div>
  );
}

export default DinasDashboardPage;
