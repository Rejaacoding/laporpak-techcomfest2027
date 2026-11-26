import { useEffect } from "react";
import {
  BrowserRouter,
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
import { RequireAuth } from "./components/auth/index.ts";
import { ToastProvider } from "./components/ui/index.js";
import { BottomNavbar, TopNavbar } from "./components/layout/index.ts";
import LoginPage from "./pages/LoginPage.tsx";
import LaporPage from "./pages/LaporPage.tsx";
import DinasDashboardPage from "./app/dinas/page.tsx";
import DinasPetaPage from "./app/dinas/peta.tsx";
import DinasRaporPage from "./app/dinas/rapor.tsx";
import JuryPanel from "./features/jury/JuryPanel.jsx";

function RouteThemeSync() {
  const { pathname } = useLocation();
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(getThemeForPath(pathname));
  }, [pathname, setTheme]);

  return null;
}

function AppShellNav() {
  const { pathname } = useLocation();
  const showMobileCitizenNav =
    !pathname.startsWith("/dinas") && !pathname.startsWith("/login");
  return (
    <>
      <TopNavbar />
      {showMobileCitizenNav && <BottomNavbar />}
    </>
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
            <AppShellNav />
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
                element={<DinasRaporPage showSidebar={false} />}
              />
              <Route path="/lapor" element={<LaporPage />} />
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
                path="/dinas/rapor"
                element={
                  <RequireAuth allowedRoles={["ADMIN_DINAS"]}>
                    <DinasRaporPage showSidebar />
                  </RequireAuth>
                }
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
