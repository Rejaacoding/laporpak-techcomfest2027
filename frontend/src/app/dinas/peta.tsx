import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  ThumbsUp,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { DinasSidebar } from "../../components/layout/index.ts";
import type {
  DinasQueueCounts,
  DinasQueueFilterKey,
} from "../../components/layout/index.ts";
import {
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
} from "../../components/ui/index.js";
import { CATEGORIES, TICKET_STATUSES } from "../../constants/designTokens.js";
import { getRapor, listDinasTickets, onJuryEvent } from "../../lib/api.js";
import { humanizeError } from "../../lib/humanize.js";

interface ApiDinasTicket {
  id: string;
  code: string;
  title: string;
  category: string;
  categoryLabel: string;
  tier: string;
  status: string;
  statusLabel: string;
  publicLat: number;
  publicLng: number;
  slaDeadline: string;
  supportCount: number;
}

const BOUNDS = {
  minLat: -7.56,
  maxLat: -7.18,
  minLng: 112.55,
  maxLng: 112.88,
};

function projectPoint(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return {
    left: `${Math.min(92, Math.max(8, x)).toFixed(1)}%`,
    top: `${Math.min(90, Math.max(10, y)).toFixed(1)}%`,
  };
}

/**
 * Peta Laporan Dinas (/dinas/peta) — menampilkan titik nyata milik instansi dari GET /api/dinas/tickets.
 */
export function DinasPetaPage() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<ApiDinasTicket[]>([]);
  const [deptScore, setDeptScore] = useState(80);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [listData, raporData] = await Promise.all([
        listDinasTickets({}, accessToken),
        getRapor().catch(() => null),
      ]);
      const items: ApiDinasTicket[] = Array.isArray(listData)
        ? listData
        : listData?.tickets || [];
      setTickets(items);
      if (items.length > 0) {
        setSelectedId((prev) =>
          prev && items.some((i) => i.id === prev) ? prev : items[0].id
        );
      }
      if (raporData?.departments && user?.departmentId) {
        const mine = raporData.departments.find(
          (d: { id: string; integrityScore: number }) =>
            d.id === user.departmentId
        );
        if (mine) setDeptScore(Math.round(mine.integrityScore));
      }
    } catch (err) {
      setErrorMsg(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.departmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return onJuryEvent("reset", () => {
      fetchData();
    });
  }, [fetchData]);

  const counts = useMemo<DinasQueueCounts>(
    () => ({
      ALL: tickets.length,
      OVERDUE: tickets.filter((t) => t.status === "OVERDUE").length,
      DISPUTED: tickets.filter((t) => t.status === "DISPUTED").length,
      ESCALATED: tickets.filter((t) => t.status === "ESCALATED").length,
      PENDING_VALIDATION: tickets.filter(
        (t) => t.status === "PENDING_VALIDATION"
      ).length,
      CLOSED: tickets.filter(
        (t) => t.status === "CLOSED" || t.status === "AUTO_CLOSED"
      ).length,
    }),
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.code.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [tickets, categoryFilter, searchQuery]);

  const selectedTicket = useMemo(
    () =>
      filteredTickets.find((t) => t.id === selectedId) ||
      filteredTickets[0] ||
      null,
    [filteredTickets, selectedId]
  );

  const handleSidebarFilter = (next: DinasQueueFilterKey) => {
    navigate(next === "ALL" ? "/dinas" : `/dinas?status=${next}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg text-fg flex flex-col">
      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        <DinasSidebar
          departmentName={user?.departmentName || "Instansi Mitra"}
          regionLabel="Kota Surabaya & Kab. Sidoarjo"
          isVerifiedPartner
          integrityScore={deptScore}
          activeFilter="ALL"
          onFilterChange={handleSidebarFilter}
          counts={counts}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="font-head font-bold text-2xl text-fg">
                Sebaran Lokasi Laporan Dinas
              </h1>
              <p className="text-sm text-fg-muted">
                Menampilkan {filteredTickets.length} titik laporan nyata milik{" "}
                {user?.departmentName || "instansi ini"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                density="dinas"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode / lokasi..."
                leftIcon={<Search className="size-4" />}
                wrapperClassName="w-full sm:w-[210px]"
              />
              <select
                aria-label="Filter kategori"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="min-h-9 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-fg"
              >
                <option value="">Semua Kategori</option>
                {CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchData}
                loading={loading}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </header>

          {errorMsg && (
            <Card className="border-red-300 bg-red-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-red-800">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchData}>
                Coba Lagi
              </Button>
            </Card>
          )}

          {loading && tickets.length === 0 ? (
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              {/* Kanvas Koordinat Nyata Surabaya-Sidoarjo */}
              <Card density="none" className="xl:col-span-8 p-4">
                <div className="relative h-[420px] rounded-xl border border-line bg-surface-2 overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle, currentColor 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  />
                  <span className="absolute top-3 left-3 text-[11px] font-mono font-semibold text-fg-muted bg-surface/90 border border-line px-2.5 py-1 rounded-lg">
                    Surabaya · Utara
                  </span>
                  <span className="absolute bottom-3 left-3 text-[11px] font-mono font-semibold text-fg-muted bg-surface/90 border border-line px-2.5 py-1 rounded-lg">
                    Sidoarjo · Selatan
                  </span>

                  {filteredTickets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-6">
                      <MapPin className="size-7 text-fg-muted" />
                      <p className="text-sm font-semibold text-fg">
                        Tidak ada titik yang cocok dengan filter
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setCategoryFilter("");
                          setSearchQuery("");
                        }}
                      >
                        Reset Filter
                      </Button>
                    </div>
                  ) : (
                    filteredTickets.map((t) => {
                      const pos = projectPoint(t.publicLat, t.publicLng);
                      const meta =
                        TICKET_STATUSES[
                          t.status as keyof typeof TICKET_STATUSES
                        ];
                      const active = selectedTicket?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          title={`${t.code}: ${t.title}`}
                          style={{
                            left: pos.left,
                            top: pos.top,
                            backgroundColor: meta?.pinHex || "#2563EB",
                          }}
                          className={[
                            "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-transform",
                            active
                              ? "size-6 ring-4 ring-brand/40 z-10 scale-110"
                              : "size-4 hover:scale-125",
                          ].join(" ")}
                          aria-label={`Pilih laporan ${t.code}`}
                        />
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Panel Detail Titik Terpilih */}
              <Card className="xl:col-span-4 flex flex-col justify-between gap-4">
                {selectedTicket ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge status={selectedTicket.status} />
                        <span className="font-mono text-xs text-fg-muted">
                          {selectedTicket.code}
                        </span>
                      </div>
                      <h2 className="font-head font-bold text-lg text-fg">
                        {selectedTicket.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge status={selectedTicket.tier} size="sm" />
                        <span className="text-xs text-fg-muted">
                          {selectedTicket.categoryLabel}
                        </span>
                      </div>
                      <div className="rounded-xl bg-surface-2 p-3 text-xs space-y-1 font-mono text-fg-muted">
                        <p>
                          Koordinat publik: {selectedTicket.publicLat.toFixed(4)}
                          , {selectedTicket.publicLng.toFixed(4)}
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-fg">
                          <ThumbsUp className="size-3.5 text-brand" />
                          {selectedTicket.supportCount} dukungan prioritas
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-line">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() =>
                          navigate(
                            `/dinas?q=${encodeURIComponent(selectedTicket.code)}`
                          )
                        }
                      >
                        Proses di Meja Kerja
                      </Button>
                      <Link
                        to={`/tiket/${selectedTicket.id}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 min-h-10 text-sm font-head font-semibold text-fg hover:bg-surface-2"
                      >
                        <span>Lihat Detail Publik</span>
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-fg-muted">
                    Pilih salah satu titik di peta untuk melihat detail laporan.
                  </p>
                )}
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default DinasPetaPage;
