/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useCopy } from "../../lib/copy-provider";
export default function AdminDashboardPage() {
  const { t } = useCopy();
  return (
    <div className="page">
      <h1>{t("admin.dashboard")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/users" style={{ textDecoration: "none" }}>员工管理</a>
          </div>
          <div className="stat-label">管理员工账号、部门、权限</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/departments" style={{ textDecoration: "none" }}>部门管理</a>
          </div>
          <div className="stat-label">组织架构维护</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/roles" style={{ textDecoration: "none" }}>角色权限</a>
          </div>
          <div className="stat-label">角色、菜单、数据权限</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/dictionaries" style={{ textDecoration: "none" }}>字典配置</a>
          </div>
          <div className="stat-label">阶段、渠道、状态等字典</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/spaces" style={{ textDecoration: "none" }}>空间管理</a>
          </div>
          <div className="stat-label">园区、楼宇、楼层、空间</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/audit" style={{ textDecoration: "none" }}>审计日志</a>
          </div>
          <div className="stat-label">操作审计记录</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/settings" style={{ textDecoration: "none" }}>系统设置</a>
          </div>
          <div className="stat-label">网站名称、Logo、公告</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/deleted" style={{ textDecoration: "none" }}>数据恢复</a>
          </div>
          <div className="stat-label">已删除数据恢复</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            <a href="/admin/exports" style={{ textDecoration: "none" }}>导出审批</a>
          </div>
          <div className="stat-label">导出申请审批管理</div>
        </div>
      </div>
    </div>
  );
}

