import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

export const Index = () => {
  const { session, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session) {
    if (role === 'staff') {
      return <Navigate to="/orders" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/auth" replace />;
};
