import { Suspense, lazy, useEffect } from "react";
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
import { CitizenOnly, RequireAuth } from "./components/auth/index.ts";
import { ProfileDrawer } from "./components/layout/ProfileDrawer.tsx";
import { ToastProvider } from "./components/ui/index.js";
import WargaBerandaPage from "./pages/warga/BerandaPage.tsx";

const LoginPage = lazy(() => import("./pages/auth/LoginPage.tsx"));
const DinasDashboardPage = lazy(() => import("./pages/dinas/DashboardPage.tsx"));
const DinasPetaPage = lazy(() => import("./pages/dinas/PetaPage.tsx"));
const DinasCatatanPage = lazy(() => import("./pages/dinas/CatatanPage.tsx"));
const WargaPetaPage = lazy(() => import("./pages/warga/PetaPage.tsx"));
const WargaLaporPage = lazy(() => import("./pages/warga/LaporPage.tsx"));
const WargaCatatanPage = lazy(() => import("./pages/warga/CatatanPage.tsx"));
const WargaTiketPage = lazy(() => import("./pages/warga/TiketDetailPage.tsx"));
const JuryPanel = lazy(() => import("./components/jury/JuryPanel.jsx"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-line border-t-brand animate-spin" />
        <p className="font-sans text-xs font-medium text-fg-muted">
          Memuat halaman...
        </p>
      </div>
    </div>
  );
}

function RouteThemeSync() {
  const { pathname } = useLocation();
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(getThemeForPath(pathname));
  }, [pathname, setTheme]);

  return null;
}

function JuryPanelBridge() {
  const { switchJuryRole } = useAuth();
  return (
    <Suspense fallback={null}>
      <JuryPanel onRoleChange={switchJuryRole} />
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider initialTheme="warm">
        <ToastProvider>
          <AuthProvider>
            <RouteThemeSync />
            <Suspense fallback={<RouteFallback />}>
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
            </Suspense>
            <ProfileDrawer />
            <JuryPanelBridge />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
