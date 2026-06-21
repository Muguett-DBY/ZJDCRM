/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

export default function AdminSpacesPage() {
  const { csrfToken } = useAuth();
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", code: "", area: "", floorId: "", statusCode: "available", notes: "" });
  const [showForm, setShowForm] = useState(false);
  const [parks, setParks] = useState<any[]>([]);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>("/spaces", { pageSize: "200" });
      setSpaces(data.items);
      setParks(await api.get<any[]>("/parks"));
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/spaces", form, csrfToken);
    setShowForm(false); setForm({ name: "", code: "", area: "", floorId: "", statusCode: "available", notes: "" }); fetch();
  };

  const handleUpdate = async (id: string, statusCode: string) => {
    const s = spaces.find((s) => s.id === id);
    if (s) { await api.put(`/spaces/${id}`, { ...s, statusCode }, csrfToken); fetch(); }
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>空间管理</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? "取消" : "新增空间"}</button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="form-field"><label>名称 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-field"><label>编码 *</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div className="form-field"><label>面积 *</label><input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required /></div>
            <div className="form-field"><label>楼层ID</label><input value={form.floorId} onChange={(e) => setForm({ ...form, floorId: e.target.value })} /></div>
            <div className="form-field"><label>状态</label>
              <select value={form.statusCode} onChange={(e) => setForm({ ...form, statusCode: e.target.value })}>
                <option value="available">可招商</option><option value="negotiating">洽谈中</option>
                <option value="signed">已签约</option><option value="occupied">已入驻</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end" }}>保存</button>
          </form>
        </div>
      )}
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>编码</th><th>名称</th><th>面积</th><th>园区</th><th>楼宇</th><th>楼层</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {spaces.map((s: any) => (
                <tr key={s.id}>
                  <td>{s.code}</td><td>{s.name}</td><td>{s.area}㎡</td>
                  <td>{s.park_name || "-"}</td><td>{s.building_name || "-"}</td><td>{s.floor_no || "-"}层</td>
                  <td>
                    <select value={s.status_code} onChange={(e) => handleUpdate(s.id, e.target.value)}>
                      <option value="available">可招商</option><option value="negotiating">洽谈中</option>
                      <option value="signed">已签约</option><option value="occupied">已入驻</option>
                    </select>
                  </td>
                  <td><span className={`badge ${s.status_code === "occupied" ? "badge-danger" : "badge-success"}`}>{s.status_code}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

