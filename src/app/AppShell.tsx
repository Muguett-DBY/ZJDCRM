import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/auth.api";
import { useAuth } from "../features/auth/auth.store";
import { useSiteSettings } from "../lib/site-settings";
import { useCopy } from "../lib/copy-provider";

const navItems = [
  { key: "nav.dashboard", path: "/", icon: "📊", adminOnly: false },
  { key: "nav.clues", path: "/clues", icon: "📋", adminOnly: false },
  { key: "nav.unassigned", path: "/unassigned", icon: "📥", adminOnly: false },
  { key: "nav.spaces", path: "/spaces", icon: "🏢", adminOnly: false },
  { key: "nav.reminders", path: "/reminders", icon: "🔔", adminOnly: false },
  { key: "nav.reports", path: "/reports", icon: "📈", adminOnly: false },
  { key: "nav.imports", path: "/imports", icon: "📤", adminOnly: false },
  { key: "nav.exports", path: "/exports", icon: "📎", adminOnly: false },
  { key: "nav.profile", path: "/profile", icon: "👤", adminOnly: false },
  { key: "nav.admin", path: "/admin", icon: "⚙️", adminOnly: true },
];

export default function AppShell() {
  const { user, csrfToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const settings = useSiteSettings();
  const { t } = useCopy();

  const handleLogout = async () => {
    try {
      await logout(csrfToken);
    } catch { /* ignore */ }
    clearSession();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>{settings.site_name || "CFZZS"}</h2>
          <span className="sidebar-subtitle">招商线索管理</span>
        </div>
        <nav className="sidebar-nav" role="navigation" aria-label="主导航">
          {navItems
            .filter((item) => !item.adminOnly || user?.canManageSystem)
            .map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              {item.icon && <span className="nav-icon">{item.icon}</span>}
              <span className="nav-label">{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.displayName || "用户"}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            退出
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
