import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute() {
  const location = useLocation();
  const token = localStorage.getItem("access");
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
