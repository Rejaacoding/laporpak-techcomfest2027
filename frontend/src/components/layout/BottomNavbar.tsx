import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Camera, Home, Map, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";

export type BottomNavTabKey = "beranda" | "peta" | "lapor" | "rapor" | "profil";

export interface BottomNavbarProps {
  /** Override active tab (defaults to route pathname) */
  activeTab?: BottomNavTabKey;
  /** Handler saat tab Profil diklik (misal buka ProfileDrawer; default ke /login jika belum masuk) */
  onProfileClick?: () => void;
  /** Handler opsional untuk tab Peta */
  onMapClick?: () => void;
  /** Tampilkan juga di desktop bila dipakai dalam preview wrapper */
  alwaysShow?: boolean;
  className?: string;
}

/**
 * Citizen Mobile Bottom Navigation Bar — matched to Figma "MobileBottomNav"
 * Height 64px (h-16), 5 items: Beranda, Peta, prominent raised Lapor FAB (size-14), Rapor, Profil.
 * Min 48px touch targets; Lapor FAB hidden for ADMIN_DINAS per docs/design.md §6.1.
 */
export function BottomNavbar({
  activeTab,
  onProfileClick,
  onMapClick,
  alwaysShow = false,
  className = "",
}: BottomNavbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const resolvedActive: BottomNavTabKey =
    activeTab ??
    (pathname.startsWith("/lapor")
      ? "lapor"
      : pathname.startsWith("/rapor")
        ? "rapor"
        : pathname.startsWith("/peta")
          ? "peta"
          : pathname.startsWith("/login")
            ? "profil"
            : "beranda");

  const hideLapor = user?.role === "ADMIN_DINAS";

  const tabClass = (isActive: boolean) =>
    [
      "flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-12 px-1 py-1 rounded-xl",
      "transition duration-150 ease-out motion-reduce:transition-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
      isActive ? "text-brand font-semibold" : "text-fg-muted font-normal hover:text-fg",
    ].join(" ");

  return (
    <nav
      aria-label="Navigasi bawah warga"
      className={[
        "fixed bottom-0 inset-x-0 z-30",
        alwaysShow ? "block" : "md:hidden",
        className,
      ].join(" ")}
    >
      <div className="relative h-16 w-full bg-surface border-t border-line px-1.5 flex items-center justify-between">
        {/* 1. Beranda */}
        <Link
          to="/"
          aria-current={resolvedActive === "beranda" ? "page" : undefined}
          className={tabClass(resolvedActive === "beranda")}
        >
          <Home className="size-[19px] shrink-0" aria-hidden="true" />
          <span className="font-sans text-[11px] leading-[14px]">Beranda</span>
        </Link>

        {/* 2. Peta */}
        {onMapClick ? (
          <button
            type="button"
            onClick={onMapClick}
            aria-current={resolvedActive === "peta" ? "page" : undefined}
            className={`${tabClass(resolvedActive === "peta")} cursor-pointer`}
          >
            <Map className="size-[19px] shrink-0" aria-hidden="true" />
            <span className="font-sans text-[11px] leading-[14px]">Peta</span>
          </button>
        ) : (
          <Link
            to="/?view=peta"
            aria-current={resolvedActive === "peta" ? "page" : undefined}
            className={tabClass(resolvedActive === "peta")}
          >
            <Map className="size-[19px] shrink-0" aria-hidden="true" />
            <span className="font-sans text-[11px] leading-[14px]">Peta</span>
          </Link>
        )}

        {/* 3. Center Raised Lapor FAB (size-14 / 56px, -mt-4) */}
        {!hideLapor && (
          <div className="relative flex flex-col items-center justify-end w-[70px] h-16 pb-1.5 shrink-0">
            <Link
              to="/lapor"
              aria-label="Buat laporan kerusakan"
              aria-current={resolvedActive === "lapor" ? "page" : undefined}
              className={[
                "absolute -top-4 left-1/2 -translate-x-1/2",
                "size-14 rounded-full flex items-center justify-center",
                "border-[3px] shadow-elevated",
                "transition duration-150 ease-out motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                resolvedActive === "lapor"
                  ? "bg-[#0D5E57] border-brand-soft text-brand-fg"
                  : "bg-brand border-surface text-brand-fg hover:brightness-110",
              ].join(" ")}
            >
              <Camera className="size-6 shrink-0" aria-hidden="true" />
            </Link>
            <span className="font-head font-semibold text-[11px] leading-[14px] text-brand">
              Lapor
            </span>
          </div>
        )}

        {/* 4. Catatan Kerja */}
        <Link
          to="/rapor"
          aria-current={resolvedActive === "rapor" ? "page" : undefined}
          className={tabClass(resolvedActive === "rapor")}
        >
          <BarChart3 className="size-[19px] shrink-0" aria-hidden="true" />
          <span className="font-sans text-[11px] leading-[14px]">Catatan</span>
        </Link>

        {/* 5. Profil */}
        <button
          type="button"
          onClick={() => {
            if (onProfileClick) {
              onProfileClick();
            } else if (!user) {
              navigate("/login");
            }
          }}
          aria-label={user ? `Profil ${user.aliasName}` : "Masuk ke profil warga"}
          aria-current={resolvedActive === "profil" ? "page" : undefined}
          className={`${tabClass(resolvedActive === "profil")} cursor-pointer`}
        >
          <User className="size-[19px] shrink-0" aria-hidden="true" />
          <span className="font-sans text-[11px] leading-[14px]">Profil</span>
        </button>
      </div>
    </nav>
  );
}

export default BottomNavbar;
