/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function AuditLogPage() {
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");

  const fetch = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page) };
      if (action) params.action = action;
      setData(await api.get<any>("/admin/audit-logs", params));
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [page, action]);

  return (
    <div className="page">
      <h1>审计日志</h1>
      <div className="filter-bar">
        <div className="form-field"><label>操作类型</label>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">全部</option>
            <option value="clue:create">新增线索</option>
            <option value="clue:edit">编辑线索</option>
            <option value="clue:delete">删除线索</option>
            <option value="clue:stage-change">阶段变更</option>
            <option value="clue:assign">分配线索</option>
            <option value="admin:user:create">创建用户</option>
          </select>
        </div>
      </div>
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>时间</th><th>操作人</th><th>操作</th><th>对象</th><th>对象ID</th><th>IP</th></tr></thead>
            <tbody>
              {data.items.map((log: any) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString("zh-CN")}</td>
                  <td>{log.actor_name || log.actor_id}</td>
                  <td>{log.action}</td>
                  <td>{log.entity_type}</td>
                  <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{log.entity_id || "-"}</td>
                  <td>{log.ip_address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

