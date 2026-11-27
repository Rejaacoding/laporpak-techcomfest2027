import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  FileEdit,
  LogOut,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { Button, Badge } from "../ui/index.js";
import { loadLaporDraft } from "../../utils/laporDraft.ts";

export const PROFILE_DRAWER_EVENT = "laporpak:open-profile";

export function openProfileDrawer() {
  window.dispatchEvent(new CustomEvent(PROFILE_DRAWER_EVENT));
}

function formatWibDate(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  return `${date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

/**
 * ProfileDrawer (US-008) — citizen identity card, Trust Score graduation bar,
 * active cooldown/freeze status, quota count, saved local draft, and sign-out.
 */
export function ProfileDrawer() {
  const navigate = useNavigate();
  const { user, signOut, isJuryMode } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener(PROFILE_DRAWER_EVENT, handleOpen);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener(PROFILE_DRAWER_EVENT, handleOpen);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (!open || !user) return null;

  const isWarga = user.role === "WARGA";
  const trustScore = Number(user.trustScore ?? 0.5);
  const trustPct = Math.max(0, Math.min(100, (trustScore / 2.0) * 100));
  const frozenText = formatWibDate(user.frozenUntil);
  const cooldownText = formatWibDate(user.cooldownUntil);
  const draft = isWarga ? loadLaporDraft() : null;
  const hasLocalDraft = Boolean(
    draft && (draft.title.trim() || draft.description.trim() || draft.photoBase64)
  );

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Profil akun LaporPAK!"
      onClick={() => setOpen(false)}
    >
      <aside
        className="w-full max-w-sm h-full bg-surface text-fg border-l border-line shadow-elevated flex flex-col justify-between overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="size-11 rounded-full bg-brand text-brand-fg flex items-center justify-center shrink-0">
                <User className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono font-bold text-sm text-fg truncate">
                  {user.aliasName}
                </p>
                <p className="font-sans text-xs text-fg-muted truncate">
                  {isWarga
                    ? "Warga Pelapor & Validator"
                    : user.departmentName || "Petugas Instansi Mitra"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup laci profil"
              className="size-9 rounded-xl border border-line flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="rounded-xl bg-surface-2 border border-line p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="size-4 text-brand mt-0.5 shrink-0" aria-hidden="true" />
            <p className="font-sans text-xs leading-relaxed text-fg-muted">
              Nama asli dan emailmu tidak pernah tampil di peta maupun dinas.
              Publik hanya melihat alias acak <strong className="text-fg">{user.aliasName}</strong>.
            </p>
          </div>

          {isWarga && (
            <>
              <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-head font-semibold text-sm text-fg inline-flex items-center gap-1.5">
                    <Sparkles className="size-4 text-brand" aria-hidden="true" />
                    Skor Kepercayaan (Trust Score)
                  </span>
                  <span className="font-mono font-bold text-base text-brand tabular-nums">
                    {trustScore.toFixed(1)} / 2.0
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={trustScore}
                  aria-valuemin={0}
                  aria-valuemax={2}
                  aria-label="Skor kepercayaan warga"
                  className="h-2.5 w-full rounded-full bg-surface-2 overflow-hidden"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${trustPct}%` }}
                  />
                </div>

                <p className="font-sans text-xs leading-relaxed text-fg-muted">
                  {trustScore < 1.0
                    ? "Akun baru mulai dari bobot 0.5 poin. Selesaikan 1 laporan sah hingga tuntas atau bantu validasi perbaikan untuk naik cepat ke 1.0 poin."
                    : "Bobot suaramu sudah terpercaya penuh (≥ 1.0). Setiap validasi jujur menambah +0.1 poin hingga maksimal 2.0."}
                </p>
              </div>

              {(frozenText || cooldownText) && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5 text-amber-950">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs leading-relaxed">
                    {frozenText ? (
                      <p>
                        <strong>Akun dibekukan sementara</strong> hingga {frozenText} akibat pelanggaran berulang.
                      </p>
                    ) : (
                      <p>
                        <strong>Masa jeda (cooldown) aktif</strong> hingga {cooldownText}. Kamu dapat kembali melapor setelah jeda berakhir.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-line bg-surface-2 p-3">
                  <span className="font-sans text-[11px] text-fg-muted block">
                    Laporan Aktif
                  </span>
                  <span className="font-mono font-bold text-lg text-fg tabular-nums">
                    {user.activeTicketCount ?? 0} / 5
                  </span>
                </div>
                <div className="rounded-xl border border-line bg-surface-2 p-3">
                  <span className="font-sans text-[11px] text-fg-muted block">
                    Mode Sesi
                  </span>
                  <div className="mt-1">
                    <Badge variant={isJuryMode ? "warning" : "success"} size="sm">
                      {isJuryMode ? "Simulasi Juri" : "Warga Aktif"}
                    </Badge>
                  </div>
                </div>
              </div>

              {hasLocalDraft && (
                <div className="rounded-xl border border-brand/30 bg-brand-soft/60 p-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-brand font-head font-semibold text-xs">
                    <FileEdit className="size-4 shrink-0" aria-hidden="true" />
                    <span>Ada draf laporan tersimpan di perangkat ini</span>
                  </div>
                  {draft?.title && (
                    <p className="font-sans text-xs text-fg truncate">
                      “{draft.title}”
                    </p>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      navigate("/lapor");
                    }}
                  >
                    Lanjutkan Draf Laporan
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-5 border-t border-line flex flex-col gap-2">
          {!isWarga && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setOpen(false);
                navigate("/dinas");
              }}
              className="w-full"
            >
              Buka Meja Kerja Dinas
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            leftIcon={<LogOut className="size-4" />}
            onClick={handleSignOut}
            className="w-full"
          >
            Keluar dari Akun
          </Button>
        </div>
      </aside>
    </div>
  );
}

export default ProfileDrawer;
