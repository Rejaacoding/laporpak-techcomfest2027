import { useAuth } from "../../context/AuthContext.tsx";

/**
 * Hides citizen-only UI (e.g. Lapor Kerusakan CTA & ProfileDrawer) from ADMIN_DINAS.
 */
export function CitizenOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user } = useAuth();
  if (user?.role === "ADMIN_DINAS") {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
