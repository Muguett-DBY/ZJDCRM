/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

export default function ExportApprovalPage() {
  const { csrfToken } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try { setRequests(await api.get<any[]>("/export-requests")); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const approve = async (id: string) => {
    await api.post(`/export-requests/${id}/approve`, {}, csrfToken);
    fetch();
  };
  const reject = async (id: string) => {
    const reason = prompt("请输入驳回原因：");
    if (reason) { await api.post(`/export-requests/${id}/reject`, { reason }, csrfToken); fetch(); }
  };

  return (
    <div className="page">
      <h1>导出审批</h1>
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : requests.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}><p className="text-muted">暂无导出申请</p></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>申请人</th><th>原因</th><th>状态</th><th>申请时间</th><th>操作</th></tr></thead>
            <tbody>
              {requests.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.requested_by}</td><td>{r.reason}</td>
                  <td><span className={`badge ${r.status === "approved" ? "badge-success" : r.status === "rejected" ? "badge-danger" : "badge-warning"}`}>{r.status}</span></td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString("zh-CN") : "-"}</td>
                  <td>
                    {r.status === "pending" && (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={() => approve(r.id)}>通过</button>
                        <button className="btn btn-sm btn-danger" onClick={() => reject(r.id)} style={{ marginLeft: 4 }}>驳回</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

