/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";
import { useAuth } from "../auth/auth.store";

export default function ExportRequestsPage() {
  const { t } = useCopy();
  const { csrfToken } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setRequests(await api.get("/export-requests")); }
    catch (cause: any) { setError(cause.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const createRequest = async () => {
    try {
      await api.post("/export-requests", { reason, scope: { entity: "clues" } }, csrfToken);
      setReason("");
      await load();
    } catch (cause: any) { setError(cause.message); }
  };

  return (
    <div className="page">
      <h1>{t("export.page.title")}</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">申请导出招商线索</div>
        <div className="form-field"><label>导出原因 *</label><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        <button className="btn btn-primary" disabled={!reason.trim()} onClick={createRequest}>提交申请</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="table-wrapper"><table>
        <thead><tr><th>原因</th><th>状态</th><th>申请时间</th><th>操作</th></tr></thead>
        <tbody>{requests.map((request) => (
          <tr key={request.id}>
            <td>{request.reason}</td><td>{request.status}</td>
            <td>{new Date(request.created_at).toLocaleString("zh-CN")}</td>
            <td>{request.status === "ready" || request.status === "downloaded" ? <a className="btn btn-sm" href={`/api/export-requests/${request.id}/download`}>下载</a> : "-"}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
