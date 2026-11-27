import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Info, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { humanizeError } from "../../utils/humanize.js";
import { Button, Card, CardContent } from "../../components/ui/index.js";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    loading: authLoading,
    sessionExpired,
    clearSessionExpired,
    signInWithPassword,
    signUpWarga,
    signInWithGoogle,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const stateExpired = Boolean(
    (location.state as { sessionExpired?: boolean } | null)?.sessionExpired
  );
  const showExpiredBanner = sessionExpired || stateExpired;

  const rawFrom = (location.state as { from?: string } | null)?.from;
  const resolvePostLoginPath = (role: "WARGA" | "ADMIN_DINAS") => {
    if (role === "ADMIN_DINAS") return "/dinas";
    if (
      typeof rawFrom === "string" &&
      rawFrom.startsWith("/") &&
      !rawFrom.startsWith("//") &&
      !rawFrom.includes("\\") &&
      !rawFrom.startsWith("/login") &&
      !rawFrom.startsWith("/dinas")
    ) {
      return rawFrom;
    }
    return "/";
  };

  // Redirect authenticated users according to role (US-011)
  useEffect(() => {
    if (authLoading || !user) return;
    navigate(resolvePostLoginPath(user.role), { replace: true });
  }, [user, authLoading, navigate, rawFrom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Email dan kata sandi wajib diisi.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setErrorMsg("Kata sandi minimal 6 karakter.");
      return;
    }

    setSubmitting(true);
    try {
      clearSessionExpired();
      if (mode === "login") {
        const profile = await signInWithPassword(email, password);
        navigate(resolvePostLoginPath(profile.role), {
          replace: true,
        });
      } else {
        const result = await signUpWarga(email, password);
        if (result.needsEmailConfirm) {
          setInfoMsg(
            "Pendaftaran berhasil! Cek kotak masuk emailmu untuk konfirmasi sebelum masuk."
          );
          setMode("login");
        } else if (result.profile) {
          navigate(resolvePostLoginPath(result.profile.role), { replace: true });
        }
      }
    } catch (err) {
      setErrorMsg(humanizeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setInfoMsg("");
    setGoogleLoading(true);
    try {
      clearSessionExpired();
      await signInWithGoogle();
    } catch (err) {
      setErrorMsg(humanizeError(err));
      setGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-fg flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            LaporPAK! · Surabaya & Sidoarjo
          </p>
          <h1 className="font-head font-bold text-2xl md:text-3xl">
            {mode === "login" ? "Masuk ke LaporPAK!" : "Daftar Akun Warga"}
          </h1>
          <p className="text-sm text-fg-muted">
            Satu pintu untuk Warga dan Petugas Instansi terdaftar.
          </p>
        </div>

        {/* Banner Sesi Kedaluwarsa (tanpa menghapus draf lokal) */}
        {showExpiredBanner && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 [[data-theme=slate]_&]:bg-amber-950/60 [[data-theme=slate]_&]:text-amber-200 [[data-theme=slate]_&]:border-amber-800"
          >
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="leading-snug">
              Sesi masukmu sudah berakhir demi keamanan akun. Jangan khawatir,
              draf laporan yang tersimpan di perangkat ini tetap aman — silakan
              masuk kembali untuk melanjutkan.
            </p>
          </div>
        )}

        <Card>
          <CardContent className="space-y-5">
            {/* Tab Masuk / Daftar Warga */}
            <div
              role="tablist"
              aria-label="Mode autentikasi"
              className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => {
                  setMode("login");
                  setErrorMsg("");
                }}
                className={[
                  "min-h-10 rounded-lg text-sm font-semibold transition duration-150 motion-reduce:transition-none cursor-pointer",
                  mode === "login"
                    ? "bg-surface text-fg shadow-sm"
                    : "text-fg-muted hover:text-fg",
                ].join(" ")}
              >
                Masuk
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => {
                  setMode("register");
                  setErrorMsg("");
                }}
                className={[
                  "min-h-10 rounded-lg text-sm font-semibold transition duration-150 motion-reduce:transition-none cursor-pointer",
                  mode === "register"
                    ? "bg-surface text-fg shadow-sm"
                    : "text-fg-muted hover:text-fg",
                ].join(" ")}
              >
                Daftar Warga
              </button>
            </div>

            {infoMsg && (
              <div
                role="status"
                className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"
              >
                {infoMsg}
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {errorMsg}
              </div>
            )}

            {/* Form Email & Password */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-medium mb-1 text-fg"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@contoh.id"
                  className="w-full min-h-12 rounded-xl border border-line bg-surface px-4 text-base text-fg placeholder:text-fg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium mb-1 text-fg"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full min-h-12 rounded-xl border border-line bg-surface pl-4 pr-12 text-base text-fg placeholder:text-fg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-10 items-center justify-center rounded-lg text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" aria-hidden="true" />
                    ) : (
                      <Eye className="size-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={googleLoading}
                className="w-full"
              >
                <Lock className="size-4" aria-hidden="true" />
                {mode === "login" ? "Masuk" : "Daftar Akun Warga"}
              </Button>
            </form>

            {/* Divider "atau" */}
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-line" />
              <span className="mx-3 shrink-0 text-xs font-medium uppercase text-fg-muted">
                atau
              </span>
              <div className="flex-grow border-t border-line" />
            </div>

            {/* Google OAuth khusus Warga */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                loading={googleLoading}
                disabled={submitting}
                onClick={handleGoogleLogin}
                className="w-full"
              >
                Masuk dengan Google
              </Button>
              <p className="text-center text-xs text-fg-muted">
                Khusus Warga. Akun instansi pemerintah masuk menggunakan email
                resmi dinas.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Kartu Jaminan Privasi (Wajib Tampil Sebelum Login) */}
        <Card className="bg-brand-soft/40 border-brand/30">
          <CardContent className="flex items-start gap-3 text-sm text-fg">
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-brand"
              aria-hidden="true"
            />
            <p className="leading-relaxed">
              Tenang, nama asli &amp; emailmu tidak pernah tampil di peta maupun
              ke dinas — otomatis disamarkan jadi alias acak (misal{" "}
              <code className="font-mono text-xs font-semibold bg-surface px-1.5 py-0.5 rounded">
                Warga-Delta-402
              </code>
              ) dan titik lokasi disamarkan ±11 meter.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
