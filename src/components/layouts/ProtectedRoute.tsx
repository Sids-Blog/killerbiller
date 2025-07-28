import { useAuth } from "@/hooks/useAuth";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { Loader2 } from "lucide-react";

const routePermissions: Record<string, string[]> = {
  '/': ['admin', 'manager'],
  '/billing': ['admin', 'manager'],
  '/orders': ['admin', 'manager', 'staff'],
  '/inventory': ['admin', 'manager'],
  '/payments': ['admin', 'manager'],
  '/customers': ['admin', 'manager'],
  '/damaged-stock': ['admin', 'manager'],
  '/admin': ['admin'],
};

export function ProtectedRoute() {
  const { session, loading, role } = useAuth();
  const location = useLocation();

  
if (loading) {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

  if (!session) {
    return <Navigate to="/" replace />;
  }

  const allowedRoles = routePermissions[location.pathname];

  if (allowedRoles && !allowedRoles.includes(role || '')) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
