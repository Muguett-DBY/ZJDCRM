/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";
import { useCopy } from "../../lib/copy-provider";

interface Role { id: string; code: string; name: string; description: string | null; is_system: number; status: string; }

export default function RolesPage() {
  const { t } = useCopy();
  const { csrfToken } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [showForm, setShowForm] = useState(false);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [dataScope, setDataScope] = useState("self");

  const fetch = async () => {
    setLoading(true);
    try {
      const [roleData, permissionData] = await Promise.all([
        api.get<Role[]>("/admin/roles"),
        api.get<any[]>("/admin/permissions"),
      ]);
      setRoles(roleData);
      setPermissions(permissionData);
    } catch {} finally { setLoading(false); }
  };

  const configure = async (role: Role) => {
    const config = await api.get<any>(`/admin/roles/${role.id}/config`);
    setEditing(role);
    setPermissionIds(config.permissionIds);
    setDataScope(config.dataScope);
  };

  const saveConfig = async () => {
    if (!editing) return;
    await api.put(`/admin/roles/${editing.id}`, {
      name: editing.name,
      description: editing.description,
      permissionIds,
      dataScope,
    }, csrfToken);
    setEditing(null);
    fetch();
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/admin/roles", form, csrfToken);
    setShowForm(false); setForm({ code: "", name: "", description: "" }); fetch();
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>{t("admin.roles")}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? "取消" : "新增角色"}</button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="form-field"><label>编码 *</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div className="form-field"><label>名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-field"><label>描述</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end" }}>保存</button>
          </form>
        </div>
      )}
      {editing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">配置角色：{editing.name}</div>
          <div className="form-field"><label>数据范围</label><select value={dataScope} onChange={(event) => setDataScope(event.target.value)}>
            <option value="self">本人</option><option value="team">本团队</option><option value="all">全部</option>
          </select></div>
          <div className="form-field"><label>权限</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              {permissions.map((permission) => <label key={permission.id}><input type="checkbox" checked={permissionIds.includes(permission.id)} onChange={(event) => setPermissionIds(event.target.checked ? [...permissionIds, permission.id] : permissionIds.filter((id) => id !== permission.id))} /> {permission.name}</label>)}
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveConfig}>保存配置</button>
          <button className="btn" onClick={() => setEditing(null)}>取消</button>
        </div>
      )}
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>编码</th><th>名称</th><th>描述</th><th>系统</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td><td>{r.name}</td><td>{r.description || "-"}</td>
                  <td>{r.is_system ? "是" : "否"}</td>
                  <td><span className={`badge ${r.status === "active" ? "badge-success" : "badge-danger"}`}>{r.status}</span></td>
                  <td><button className="btn btn-sm" onClick={() => configure(r)}>配置权限</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

