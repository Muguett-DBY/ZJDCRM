/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

export default function DictionariesPage() {
  const { csrfToken } = useAuth();
  const [data, setData] = useState<{ dictionaries: any[]; items: any[] }>({ dictionaries: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", name: "", category: "" });
  const [showForm, setShowForm] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { setData(await api.get<any>("/admin/dictionaries")); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/admin/dictionaries", form, csrfToken);
    setShowForm(false); setForm({ code: "", name: "", category: "" }); fetch();
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>字典配置</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? "取消" : "新增字典"}</button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="form-field"><label>编码 *</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div className="form-field"><label>名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-field"><label>分类</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end" }}>保存</button>
          </form>
        </div>
      )}
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {data.dictionaries.map((dict: any) => (
            <div className="card" key={dict.id}>
              <div className="card-header">{dict.name}（{dict.code}）</div>
              <table>
                <thead><tr><th>编码</th><th>名称</th><th>排序</th><th>状态</th></tr></thead>
                <tbody>
                  {data.items.filter((i: any) => i.dictionary_id === dict.id).map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.code}</td><td>{item.name}</td><td>{item.sort_order}</td>
                      <td><span className={`badge ${item.status === "active" ? "badge-success" : "badge-danger"}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

