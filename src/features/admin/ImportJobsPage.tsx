/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function ImportJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>("/imports").then((d) => setJobs(d.items || d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1>导入任务</h1>
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : jobs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}><p className="text-muted">暂无导入任务</p></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>类型</th><th>文件名</th><th>状态</th><th>成功</th><th>失败</th><th>时间</th></tr></thead>
            <tbody>
              {jobs.map((j: any) => (
                <tr key={j.id}>
                  <td>{j.job_type}</td><td>{j.source_file_name || "-"}</td>
                  <td><span className={`badge ${j.status === "completed" ? "badge-success" : "badge-warning"}`}>{j.status}</span></td>
                  <td>{j.success_rows}</td><td>{j.failed_rows}</td>
                  <td>{j.created_at ? new Date(j.created_at).toLocaleString("zh-CN") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

