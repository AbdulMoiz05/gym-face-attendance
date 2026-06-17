import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, ClipboardCheck, ScanFace, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/api/axios";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "People", icon: Users, path: "/people" },
  { label: "Attendance", icon: ClipboardCheck, path: "/attendance" },
];

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get("/auth/me/").then((res) => setUser(res.data)).catch(() => {});
  }, []);

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <ScanFace size={20} />
        </div>
        <div>
          <h1 className="sidebar-title">Face Attendance</h1>
          <p className="sidebar-subtitle">AI check-in</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} className={cn("sidebar-link", isActive && "active")}>
              <item.icon size={18} className="sidebar-link-icon" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-footer-link" style={{ border: "none", background: "none", width: "100%", cursor: "pointer", textAlign: "left" }} onClick={logout}>
          <LogOut size={16} />
          Logout
        </button>
        <div className="sidebar-gym-card">
          <p>{user?.full_name || "Signed in"}</p>
          <p className="muted">{user?.email || ""}</p>
        </div>
      </div>
    </aside>
  );
}
