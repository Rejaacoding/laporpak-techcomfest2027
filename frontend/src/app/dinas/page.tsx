import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { TopNavbar, DinasSidebar } from "../../components/layout/index.ts";
import type { DinasQueueFilterKey } from "../../components/layout/index.ts";
import {
  AlertBanners,
  StatOverview,
  TicketTable,
} from "../../components/dinas/index.ts";
import { Button, Input, Modal, useToast } from "../../components/ui/index.js";
import {
  DINAS_DEPARTMENT_META,
  DINAS_KPI_STATS,
  DINAS_MOCK_TICKETS,
  DINAS_QUEUE_COUNTS,
} from "../../data/mockTickets.ts";
import type { DinasTicketRow, TicketActionItem } from "../../data/mockTickets.ts";

type RegionFilter = "ALL" | "Surabaya" | "Sidoarjo";

const REGION_CYCLE: RegionFilter[] = ["ALL", "Surabaya", "Sidoarjo"];

/**
 * Dashboard Dinas (/dinas) — sliced from Figma "05 — Dashboard Dinas (/dinas)"
 * Uses TopNavbar, DinasSidebar, StatOverview, AlertBanners, and TicketTable.
 */
export function DinasDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeFilter, setActiveFilter] = useState<DinasQueueFilterKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("ALL");
  const [selectedAction, setSelectedAction] = useState<{
    ticket: DinasTicketRow;
    action: TicketActionItem;
  } | null>(null);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return DINAS_MOCK_TICKETS.filter((ticket) => {
      if (activeFilter !== "ALL" && ticket.status !== activeFilter) {
        return false;
      }
      if (regionFilter !== "ALL" && ticket.region !== regionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        ticket.id.toLowerCase().includes(q) ||
        ticket.categoryTitle.toLowerCase().includes(q) ||
        ticket.location.toLowerCase().includes(q)
      );
    });
  }, [activeFilter, regionFilter, searchQuery]);

  const handleCycleRegion = () => {
    const idx = REGION_CYCLE.indexOf(regionFilter);
    const next = REGION_CYCLE[(idx + 1) % REGION_CYCLE.length];
    setRegionFilter(next);
  };

  const handleResetFilters = () => {
    setActiveFilter("ALL");
    setRegionFilter("ALL");
    setSearchQuery("");
  };

  const handleTicketAction = (
    ticket: DinasTicketRow,
    action: TicketActionItem
  ) => {
    if (action.disabled) return;
    setSelectedAction({ ticket, action });
  };

  const handleConfirmAction = () => {
    if (!selectedAction) return;
    showToast({
      type: "success",
      title: `${selectedAction.action.label} diproses`,
      message: `${selectedAction.ticket.id} (${selectedAction.ticket.categoryTitle}) berhasil diperbarui.`,
    });
    setSelectedAction(null);
  };

  const departmentName =
    user?.departmentName || DINAS_DEPARTMENT_META.departmentName;
  const profileLabel = user?.departmentShortName
    ? `Admin · ${user.departmentShortName}`
    : `Admin · ${DINAS_DEPARTMENT_META.departmentShortName}`;

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <TopNavbar profileLabel={profileLabel} />

      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        <DinasSidebar
          departmentName={departmentName}
          regionLabel={DINAS_DEPARTMENT_META.regionLabel}
          isVerifiedPartner={DINAS_DEPARTMENT_META.isVerifiedPartner}
          integrityScore={DINAS_DEPARTMENT_META.integrityScore}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={DINAS_QUEUE_COUNTS}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-7 flex flex-col gap-5">
          {/* Header / Page Title & Actions */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="font-head font-bold text-2xl md:text-[30px] md:leading-9 text-fg">
                Meja Kerja Antrean Dinas
              </h1>
              <p className="font-sans text-sm leading-5 text-fg-muted">
                Tiket diurutkan otomatis dari status Melewati Tenggat dan sisa
                waktu SLA tersingkat · Sinkronisasi terakhir: baru saja
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
              <Input
                density="dinas"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* 4 KPI Summary Cards */}
          <StatOverview stats={DINAS_KPI_STATS} />

          {/* Disputed 24h & Escalated Berita Acara Banners */}
          <AlertBanners
            onProcessRework={(ticketId) =>
              showToast({
                type: "info",
                title: "Proses Perbaikan Ulang",
                message: `Tiket ${ticketId} dikembalikan ke status Sedang Ditangani (+24 jam buffer).`,
              })
            }
            onAppealEvidence={(ticketId) =>
              showToast({
                type: "info",
                title: "Banding Bukti (1×)",
                message: `Siapkan foto sudut terbaru (≤75 m) untuk tiket ${ticketId}.`,
              })
            }
            onUploadEscalation={(ticketId) =>
              showToast({
                type: "warning",
                title: "Dokumen Eskalasi Wajib",
                message: `Tiket ${ticketId} membutuhkan Berita Acara (PDF/JPG ≤5 MB) dan Foto Live.`,
              })
            }
          />

          {/* Status Filter Tabs + Priority Queue Table */}
          <TicketTable
            tickets={filteredTickets}
            activeTab={activeFilter}
            onTabChange={setActiveFilter}
            onAction={handleTicketAction}
            onResetFilters={handleResetFilters}
          />
        </main>
      </div>

      {/* Konfirmasi Aksi Dinas */}
      <Modal
        open={Boolean(selectedAction)}
        onClose={() => setSelectedAction(null)}
        title={
          selectedAction
            ? `${selectedAction.action.label} — ${selectedAction.ticket.id}`
            : undefined
        }
        description={
          selectedAction
            ? `${selectedAction.ticket.categoryTitle} · ${selectedAction.ticket.location}`
            : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <p className="font-sans text-sm text-fg-muted">
            Tindakan ini akan dicatat ke rantai audit kriptografi{" "}
            <span className="font-mono text-xs text-fg">AuditLog</span> dan
            memperbarui status antrean dinas secara langsung.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setSelectedAction(null)}
            >
              Batal
            </Button>
            <Button
              variant={
                selectedAction?.action.variant === "danger"
                  ? "danger"
                  : "primary"
              }
              size="md"
              onClick={handleConfirmAction}
            >
              Konfirmasi {selectedAction?.action.label}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DinasDashboardPage;
