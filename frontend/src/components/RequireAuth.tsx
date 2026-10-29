import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import type { Rol } from "../types";

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: Rol[];
}) {
  const { isAuthenticated, rol } = useAuth();
  if (!isAuthenticated || !rol) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(rol)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
