import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/auth.api";
import { useAuth } from "../features/auth/auth.store";
import { useSiteSettings } from "../lib/site-settings";
import { useCopy } from "../lib/copy-provider";

const adminNavItems = [
  { key: "admin.dashboard", path: "/admin", icon: "📊", end: true },
  { key: "admin.users", path: "/admin/users", icon: "👥" },
  { key: "admin.departments", path: "/admin/departments", icon: "🏛️" },
  { key: "admin.roles", path: "/admin/roles", icon: "🔐" },
  { key: "admin.dictionaries", path: "/admin/dictionaries", icon: "📚" },
  { key: "admin.spaces", path: "/admin/spaces", icon: "🏢" },
  { key: "admin.imports", path: "/admin/imports", icon: "📤" },
  { key: "admin.exports", path: "/admin/exports", icon: "📎" },
  { key: "admin.audit", path: "/admin/audit", icon: "📝" },
  { key: "admin.settings", path: "/admin/settings", icon: "⚙️" },
  { key: "admin.recovery", path: "/admin/deleted", icon: "♻️" },
  { key: "admin.copy", path: "/admin/copy", icon: "✍️" },
];

export default function AdminShell() {
  const { user, csrfToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const settings = useSiteSettings();
  const { t } = useCopy();

  const handleLogout = async () => {
    try { await logout(csrfToken); } catch { /* ignore */ }
    clearSession();
    navigate("/login");
  };

  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>系统管理</h2>
          <span className="sidebar-subtitle">{settings.site_name || "CFZZS"} 后台</span>
        </div>
        <nav className="sidebar-nav" role="navigation" aria-label="管理导航">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-return-link">
          <NavLink to="/" className="nav-item">
            <span className="nav-icon">←</span>
            <span className="nav-label">返回业务端</span>
          </NavLink>
        </div>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.displayName || "管理员"}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>退出</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
