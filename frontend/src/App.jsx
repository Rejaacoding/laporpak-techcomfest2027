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
import { CitizenOnly, RequireAuth } from "./components/auth/index.ts";
import { ToastProvider } from "./components/ui/index.js";
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
