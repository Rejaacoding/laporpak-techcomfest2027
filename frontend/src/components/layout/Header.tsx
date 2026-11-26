import { Link, useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { Button } from "../ui/index.js";

export interface HeaderProps {
  /** Teks wilayah layanan di bawah logo */
  regionLabel?: string;
  /** Override status login (jika tidak diisi, membaca dari AuthContext) */
  aliasName?: string | null;
  /** Handler saat tombol Masuk diklik (default navigasi ke /login) */
  onLoginClick?: () => void;
  /** Handler saat lencana alias warga diklik (misal buka Profile Drawer) */
  onProfileClick?: () => void;
  className?: string;
}

/**
 * Citizen Mobile Header — matched to Figma "MobileTopBar" (State=Guest / State=LoggedIn).
 * Height 56px (h-14), bg-surface (#FFFFFF), border-b border-line (#E7DFD3), px-4.
 */
export function Header({
  regionLabel = "Sidoarjo • Surabaya",
  aliasName,
  onLoginClick,
  onProfileClick,
  className = "",
}: HeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const resolvedAlias =
    aliasName !== undefined ? aliasName : user?.aliasName ?? null;

  const handleLogin = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      navigate("/login");
    }
  };

  return (
    <header
      className={[
        "h-14 w-full bg-surface border-b border-line px-4",
        "sticky top-0 z-30 flex items-center justify-between gap-2",
        className,
      ].join(" ")}
    >
      {/* Left: Brand Logo & Region */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span
          className="size-7 rounded-lg bg-brand text-brand-fg flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <MapPin className="size-[15px]" strokeWidth={2} />
        </span>

        <span className="flex flex-col leading-none">
          <span className="font-head font-bold text-[15px] leading-[18px] text-fg tracking-tight">
            LaporPAK!
          </span>
          <span className="font-mono font-medium text-[9px] leading-3 text-brand">
            {regionLabel}
          </span>
        </span>
      </Link>

      {/* Right: Guest "Masuk" Button OR Logged-in Citizen Alias Pill */}
      {resolvedAlias ? (
        <button
          type="button"
          onClick={onProfileClick}
          aria-label={`Buka profil warga ${resolvedAlias}`}
          className={[
            "inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-line",
            "px-2.5 py-[5px] text-fg shrink-0",
            "transition duration-150 ease-out motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            onProfileClick ? "cursor-pointer hover:border-brand/60" : "cursor-default",
          ].join(" ")}
        >
          <span
            className="size-[7px] rounded-full bg-brand shrink-0"
            aria-hidden="true"
          />
          <span className="font-mono font-medium text-[10px] leading-[14px] text-fg max-w-[140px] truncate">
            {resolvedAlias}
          </span>
        </button>
      ) : (
        <Button variant="primary" size="sm" onClick={handleLogin}>
          Masuk
        </Button>
      )}
    </header>
  );
}

export default Header;
