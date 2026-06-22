import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";

export default function ReportsPage() {
  const { t } = useCopy();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get("/reports").then(setData).catch((cause) => setError(cause.message));
  }, []);

  const table = (title: string, rows: any[], labelKey: string, valueKey = "total") => (
    <div className="card">
      <div className="card-header">{title}</div>
      {rows.length === 0 ? <p className="text-muted">暂无数据</p> : (
        <table><thead><tr><th>项目</th><th>数量</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}><td>{row[labelKey]}</td><td>{row[valueKey]}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="page">
      <h1>{t("report.page.title")}</h1>
      {error && <div className="form-error">{error}</div>}
      {!data ? <div className="loading-screen"><div className="spinner" /></div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {table("招商阶段分布", data.stageDistribution, "stage_code")}
          {table("渠道来源分析", data.sourceDistribution, "source_code")}
          {table("人员负责线索", data.ownerPerformance, "owner_name", "clue_count")}
          {table("空间状态", data.spaceStatus, "status_code")}
        </div>
      )}
    </div>
  );
}
