import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/auth.api";
import { useAuth } from "../features/auth/auth.store";

const navItems = [
  { label: "首页看板", path: "/", icon: "📊", adminOnly: false },
  { label: "招商线索", path: "/clues", icon: "📋", adminOnly: false },
  { label: "未分配线索", path: "/unassigned", icon: "📥", adminOnly: false },
  { label: "空间资源", path: "/spaces", icon: "🏢", adminOnly: false },
  { label: "跟进提醒", path: "/reminders", icon: "🔔", adminOnly: false },
  { label: "数据报表", path: "/reports", icon: "📈", adminOnly: false },
  { label: "数据导入", path: "/imports", icon: "📤", adminOnly: false },
  { label: "导出管理", path: "/exports", icon: "📎", adminOnly: false },
  { label: "个人设置", path: "/profile", icon: "👤", adminOnly: false },
  { label: "⚙️ 系统管理", path: "/admin", icon: "", adminOnly: true },
];

export default function AppShell() {
  const { user, csrfToken, clearSession } = useAuth();
  const navigate = useNavigate();

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
          <h2>ZJDCRM</h2>
          <span className="sidebar-subtitle">招商线索管理</span>
        </div>
        <nav className="sidebar-nav" role="navigation" aria-label="主导航">
          {navItems
            .filter((item) => !item.adminOnly || user?.isSuperAdmin)
            .map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              {item.icon && <span className="nav-icon">{item.icon}</span>}
              <span className="nav-label">{item.label}</span>
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
