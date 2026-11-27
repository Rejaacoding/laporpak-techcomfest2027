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
import LoginPage from "./pages/auth/LoginPage.tsx";
import DinasDashboardPage from "./pages/dinas/DashboardPage.tsx";
import DinasPetaPage from "./pages/dinas/PetaPage.tsx";
import DinasCatatanPage from "./pages/dinas/CatatanPage.tsx";
import WargaBerandaPage from "./pages/warga/BerandaPage.tsx";
import WargaPetaPage from "./pages/warga/PetaPage.tsx";
import WargaLaporPage from "./pages/warga/LaporPage.tsx";
import WargaCatatanPage from "./pages/warga/CatatanPage.tsx";
import WargaTiketPage from "./pages/warga/TiketDetailPage.tsx";
import JuryPanel from "./components/jury/JuryPanel.jsx";

function RouteThemeSync() {
  const { pathname } = useLocation();
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(getThemeForPath(pathname));
  }, [pathname, setTheme]);

  return null;
}

function TopNav() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  if (
    pathname === "/" ||
    pathname.startsWith("/peta") ||
    pathname.startsWith("/lapor") ||
    pathname.startsWith("/tiket") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/dinas") ||
    pathname.startsWith("/catatan") ||
    pathname.startsWith("/rapor")
  ) {
    return null;
  }

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
          <Link to="/catatan" className="text-fg hover:text-brand">
            Catatan
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

function JuryPanelBridge() {
  const { switchJuryRole } = useAuth();
  return <JuryPanel onRoleChange={switchJuryRole} />;
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
              <Route path="/" element={<WargaBerandaPage />} />
              <Route path="/peta" element={<WargaPetaPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/tiket/:id" element={<WargaTiketPage />} />
              <Route path="/catatan" element={<WargaCatatanPage />} />
              <Route path="/rapor" element={<Navigate to="/catatan" replace />} />
              <Route
                path="/lapor"
                element={
                  <CitizenOnly fallback={<Navigate to="/dinas" replace />}>
                    <WargaLaporPage />
                  </CitizenOnly>
                }
              />
              <Route
                path="/dinas"
                element={
                  <RequireAuth allowedRoles={["ADMIN_DINAS"]}>
                    <DinasDashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/dinas/peta"
                element={
                  <RequireAuth allowedRoles={["ADMIN_DINAS"]}>
                    <DinasPetaPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/dinas/catatan"
                element={
                  <RequireAuth allowedRoles={["ADMIN_DINAS"]}>
                    <DinasCatatanPage showSidebar />
                  </RequireAuth>
                }
              />
              <Route
                path="/dinas/rapor"
                element={<Navigate to="/dinas/catatan" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <JuryPanelBridge />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
