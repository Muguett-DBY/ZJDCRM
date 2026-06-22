/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";
import { useCopy } from "../../lib/copy-provider";

interface Dept { id: string; parent_id: string | null; code: string; name: string; sort_order: number; status: string; }

export default function DepartmentsPage() {
  const { t } = useCopy();
  const { csrfToken } = useAuth();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", name: "", parentId: "", sortOrder: "0" });
  const [showForm, setShowForm] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { setDepts((await api.get<Dept[]>("/admin/departments"))); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/admin/departments", form, csrfToken);
    setShowForm(false); setForm({ code: "", name: "", parentId: "", sortOrder: "0" }); fetch();
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>{t("admin.departments")}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? "取消" : "新增部门"}</button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="form-field"><label>编码 *</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div className="form-field"><label>名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-field"><label>上级ID</label><input value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} /></div>
            <div className="form-field"><label>排序</label><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end" }}>保存</button>
          </form>
        </div>
      )}
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>编码</th><th>名称</th><th>上级</th><th>排序</th><th>状态</th></tr></thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.id}>
                  <td>{d.code}</td><td>{d.name}</td><td>{d.parent_id || "-"}</td>
                  <td>{d.sort_order}</td>
                  <td><span className={`badge ${d.status === "active" ? "badge-success" : "badge-danger"}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

