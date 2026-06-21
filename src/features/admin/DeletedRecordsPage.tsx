/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

export default function DeletedRecordsPage() {
  const { csrfToken } = useAuth();
  const [type, setType] = useState("clues");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try { setRows(await api.get<any[]>(`/admin/deleted-records?type=${type}`)); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [type]);

  const restore = async (id: string) => {
    await api.post(`/admin/deleted-records/${type}/${id}/restore`, {}, csrfToken);
    fetch();
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>数据恢复</h1>
        <div className="form-field">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="clues">线索</option>
            <option value="companies">企业</option>
            <option value="contacts">联系人</option>
          </select>
        </div>
      </div>
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}><p className="text-muted">暂无已删除数据</p></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>ID</th><th>名称</th><th>删除时间</th><th>操作</th></tr></thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>{r.id}</td>
                  <td>{r.title || r.name || "-"}</td>
                  <td>{r.deleted_at ? new Date(r.deleted_at).toLocaleString("zh-CN") : "-"}</td>
                  <td><button className="btn btn-sm btn-primary" onClick={() => restore(r.id)}>恢复</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

