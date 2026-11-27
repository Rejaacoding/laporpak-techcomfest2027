import { Link, useLocation } from "react-router-dom";
import { LogOut, MapPin, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { CitizenOnly } from "../auth/index.ts";
import { Button } from "../ui/index.js";

export interface TopNavbarNavItem {
  to: string;
  label: string;
  /** Optional role restriction; if omitted, visible to everyone */
  roles?: Array<"WARGA" | "ADMIN_DINAS">;
  /** Hide when user is ADMIN_DINAS (citizen-only link) */
  citizenOnly?: boolean;
}

export interface TopNavbarProps {
  /** Override department or user label shown inside the right profile pill */
  profileLabel?: string;
  /** Optional click handler for the profile badge (e.g., open Profile Drawer) */
  onProfileClick?: () => void;
  /** Optional custom navigation links; defaults to LaporPAK! Figma spec */
  navItems?: TopNavbarNavItem[];
  className?: string;
}

const DEFAULT_NAV_ITEMS: TopNavbarNavItem[] = [
  { to: "/", label: "Peta Laporan" },
  { to: "/lapor", label: "Buat Laporan", citizenOnly: true },
  { to: "/dinas", label: "Antrean Dinas", roles: ["ADMIN_DINAS"] },
  { to: "/catatan", label: "Catatan" },
];

/**
 * Unified Top Navigation Bar across all LaporPAK! pages (warm / blueprint / slate).
 */
export function TopNavbar({
  profileLabel,
  onProfileClick,
  navItems = DEFAULT_NAV_ITEMS,
  className = "",
}: TopNavbarProps) {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  const isActiveRoute = (to: string) => {
    if (to === "/" || to === "/dinas") return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const resolvedProfileLabel =
    profileLabel ??
    (user?.role === "ADMIN_DINAS"
      ? `Admin · ${user.departmentShortName || user.departmentName || user.departmentId || "Dinas"}`
      : user?.aliasName || "Pengunjung Publik");

  return (
    <header
      className={[
        "h-16 w-full bg-surface/95 backdrop-blur-sm border-b border-line px-4 md:px-5",
        "sticky top-0 z-30",
        className,
      ].join(" ")}
    >
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between gap-6">
        {/* Left: Brand Logo (Navbar / Brand Logo) */}
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span
            className="size-[34px] rounded-[10px] bg-brand text-brand-fg flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <MapPin className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="font-head font-bold text-[18px] leading-[22px] text-fg tracking-tight">
            LaporPAK!
          </span>
        </Link>

        {/* Center: Menu Links (Navbar / Menu Links) */}
        <nav
          aria-label="Navigasi utama"
          className="hidden md:flex items-center gap-1.5 h-9"
        >
          {navItems.map((item) => {
            if (item.roles && (!user || !item.roles.includes(user.role))) {
              return null;
            }

            const targetTo =
              item.to === "/" && user?.role === "ADMIN_DINAS"
                ? "/dinas/peta"
                : item.to === "/catatan" && user?.role === "ADMIN_DINAS"
                  ? "/dinas/catatan"
                  : item.to;
            const active = isActiveRoute(targetTo);
            const linkEl = (
              <Link
                key={item.to}
                to={targetTo}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex items-center h-9 px-3.5 py-2 rounded-[10px]",
                  "font-head text-sm leading-5 whitespace-nowrap",
                  "transition duration-150 ease-out motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                  active
                    ? "bg-brand-soft text-brand font-semibold"
                    : "text-fg-muted font-medium hover:text-fg hover:bg-surface-2",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );

            if (item.citizenOnly) {
              return <CitizenOnly key={item.to}>{linkEl}</CitizenOnly>;
            }
            return linkEl;
          })}
        </nav>

        {/* Right: Dinas / Citizen Profile Pill + Auth Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <>
              <button
                type="button"
                onClick={onProfileClick}
                disabled={!onProfileClick}
                aria-label={`Profil aktif: ${resolvedProfileLabel}`}
                className={[
                  "inline-flex items-center gap-2 h-10 pl-2 pr-3 py-1.5 rounded-full",
                  "bg-surface border border-line text-fg",
                  onProfileClick
                    ? "cursor-pointer hover:bg-surface-2 transition duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    : "cursor-default",
                ].join(" ")}
              >
                <span
                  className="size-[26px] rounded-full bg-brand text-brand-fg flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <User className="size-3.5" strokeWidth={2} />
                </span>
                <span className="font-mono font-medium text-xs leading-4 text-fg whitespace-nowrap max-w-[180px] truncate">
                  {resolvedProfileLabel}
                </span>
              </button>

              <Button
                variant="secondary"
                density="dinas"
                onClick={signOut}
                aria-label="Keluar dari akun"
                className="hidden sm:inline-flex"
              >
                <LogOut className="size-4 shrink-0" aria-hidden="true" />
                <span>Keluar</span>
              </Button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-brand text-brand-fg px-4 min-h-10 text-sm font-head font-semibold hover:brightness-110 transition duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopNavbar;
