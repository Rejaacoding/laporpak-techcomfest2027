import { useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  ThemeProvider,
  getThemeForPath,
  useTheme,
} from "./context/ThemeContext.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.tsx";
import { CitizenOnly, RequireAuth } from "./components/auth/index.ts";
import { Button, ToastProvider } from "./components/ui/index.js";
import LoginPage from "./pages/LoginPage.tsx";
import LaporPage from "./pages/LaporPage.tsx";

function RouteThemeSync() {
  const { pathname } = useLocation();
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(getThemeForPath(pathname));
  }, [pathname, setTheme]);

  return null;
}

function TopNav() {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 bg-surface border-b border-line px-4 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
        <Link
          to="/"
          className="font-head font-bold text-lg text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg px-1"
        >
          LaporPAK!
        </Link>

        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link to="/" className="text-fg hover:text-brand">
            Peta
          </Link>
          <Link to="/rapor" className="text-fg hover:text-brand">
            Rapor
          </Link>
          <CitizenOnly>
            <Link to="/lapor" className="text-brand font-semibold">
              Lapor Kerusakan
            </Link>
          </CitizenOnly>
          {user?.role === "ADMIN_DINAS" && (
            <Link to="/dinas" className="text-brand font-semibold">
              Meja Dinas
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <CitizenOnly>
                <span className="text-xs font-mono text-fg-muted hidden sm:inline">
                  {user.aliasName}
                </span>
              </CitizenOnly>
              <Button variant="secondary" density="dinas" onClick={signOut}>
                Keluar
              </Button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-brand text-brand-fg px-4 min-h-9 text-sm font-semibold hover:brightness-110"
            >
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function PageShell({ title, subtitle }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-bg text-fg py-10 px-4 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-2">
        <h1 className="font-head font-bold text-2xl md:text-3xl">{title}</h1>
        <p className="text-fg-muted">{subtitle}</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider initialTheme="warm">
        <ToastProvider>
          <AuthProvider>
            <RouteThemeSync />
            <TopNav />
            <Routes>
              <Route
                path="/"
                element={
                  <PageShell
                    title="Peta Laporan Warga"
                    subtitle="Halaman publik beranda & peta Surabaya–Sidoarjo."
                  />
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/tiket/:id"
                element={
                  <PageShell
                    title="Detail Tiket & Uji Publik"
                    subtitle="Halaman publik detail laporan."
                  />
                }
              />
              <Route
                path="/rapor"
                element={
                  <PageShell
                    title="Rapor Integritas Dinas"
                    subtitle="Halaman publik peringkat & audit kinerja dinas."
                  />
                }
              />
              <Route path="/lapor" element={<LaporPage />} />
              <Route
                path="/dinas"
                element={
                  <RequireAuth allowedRoles={["ADMIN_DINAS"]}>
                    <PageShell
                      title="Meja Kerja Dinas"
                      subtitle="Khusus petugas instansi terdaftar."
                    />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
