/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

interface Role { id: string; code: string; name: string; description: string | null; is_system: number; status: string; }

export default function RolesPage() {
  const { csrfToken } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [showForm, setShowForm] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { setRoles(await api.get<Role[]>("/admin/roles")); } catch {} finally { setLoading(false); }
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
        <h1>角色权限</h1>
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
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>编码</th><th>名称</th><th>描述</th><th>系统</th><th>状态</th></tr></thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td><td>{r.name}</td><td>{r.description || "-"}</td>
                  <td>{r.is_system ? "是" : "否"}</td>
                  <td><span className={`badge ${r.status === "active" ? "badge-success" : "badge-danger"}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

