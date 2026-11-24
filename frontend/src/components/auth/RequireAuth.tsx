import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "../../context/AuthContext.tsx";
import { useToast } from "../ui/Toast.jsx";
import { Skeleton } from "../ui/Skeleton.jsx";

interface RequireAuthProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

/**
 * Route Guard (US-011):
 * - Unauthenticated -> /login (preserving destination & sessionExpired flag)
 * - WARGA accessing /dinas -> / with polite toast
 * - ADMIN_DINAS accessing /lapor -> /dinas
 */
export function RequireAuth({ allowedRoles, children }: RequireAuthProps) {
  const { user, loading, sessionExpired } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const toastedRef = useRef(false);

  const isRoleBlocked = Boolean(
    !loading && user && allowedRoles && !allowedRoles.includes(user.role)
  );

  useEffect(() => {
    if (isRoleBlocked && user?.role === "WARGA" && !toastedRef.current) {
      toastedRef.current = true;
      showToast({
        type: "info",
        message: "Halaman ini khusus petugas instansi terdaftar.",
      });
    }
  }, [isRoleBlocked, user?.role, showToast]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname, sessionExpired }}
        replace
      />
    );
  }

  if (isRoleBlocked) {
    const fallback = user.role === "ADMIN_DINAS" ? "/dinas" : "/";
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
