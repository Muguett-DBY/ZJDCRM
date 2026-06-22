/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";

interface DashboardData {
  newClues: number;
  stageDistribution: { stage_code: string; total: number }[];
  sourceDistribution: { source_code: string; total: number }[];
  signedCount: number;
  visitCount: number;
  tourCount: number;
  signedArea: number;
  landedCount: number;
  expectedArea: number;
  expectedOutput: number;
  expectedTax: number;
  spaceStatus: { status_code: string; total: number }[];
  upcomingReminders: { id: string; title: string; next_followup_at: string; owner_name: string }[];
}

const stageLabels: Record<string, string> = {
  new: "新线索", filed: "已建档", initial_contact: "初步接触",
  needs_confirmed: "需求确认", key_followup: "重点跟进", site_visit: "考察洽谈",
  intent_confirmed: "意向确认", contract_pending: "签约推进", signed: "已签约",
  landed: "已落地", lost: "暂缓/流失",
};

export default function DashboardPage() {
  const { t } = useCopy();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<DashboardData>("/dashboard", { startDate, endDate });
      setData(result);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="page">
      <div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>{t("dashboard.page.title")}</h1>
        <div className="dashboard-filters" style={{ display: "flex", gap: 8 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--color-border)", borderRadius: 4 }} />
          <span style={{ alignSelf: "center" }}>至</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--color-border)", borderRadius: 4 }} />
        </div>
      </div>

      {loading && !data ? (
        <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
            <div className="stat-card"><div className="stat-value">{data?.newClues || 0}</div><div className="stat-label">新增线索</div></div>
            <div className="stat-card"><div className="stat-value">{data?.signedCount || 0}</div><div className="stat-label">已签约</div></div>
            <div className="stat-card"><div className="stat-value">{data?.visitCount || 0}</div><div className="stat-label">客户拜访（按线索去重）</div></div>
            <div className="stat-card"><div className="stat-value">{data?.tourCount || 0}</div><div className="stat-label">园区带看（按线索去重）</div></div>
            <div className="stat-card"><div className="stat-value">{data?.signedArea ? `${data.signedArea}㎡` : "-"}</div><div className="stat-label">确认签约去化</div></div>
            <div className="stat-card"><div className="stat-value">{data?.landedCount || 0}</div><div className="stat-label">已落地</div></div>
            <div className="stat-card"><div className="stat-value">{data?.expectedArea ? `${data.expectedArea}㎡` : "-"}</div><div className="stat-label">预计面积</div></div>
            <div className="stat-card"><div className="stat-value">{data?.expectedOutput ?? "-"}</div><div className="stat-label">预计产值</div></div>
            <div className="stat-card"><div className="stat-value">{data?.expectedTax ?? "-"}</div><div className="stat-label">预计税收</div></div>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: -12, marginBottom: 16 }}>时间筛选只影响事件数量；跨园区预选汇总会按园区重复计入，不作去重。</p>

          {/* Stage Distribution Table */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">阶段分布</div>
            {(data?.stageDistribution || []).length > 0 ? (
              <table>
                <thead><tr><th>阶段</th><th>数量</th></tr></thead>
                <tbody>
                  {data?.stageDistribution.map((s) => (
                    <tr key={s.stage_code}>
                      <td>{stageLabels[s.stage_code] || s.stage_code}</td>
                      <td>{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-muted">暂无阶段数据</p>}
          </div>

          {/* Reminders */}
          <div className="card">
            <div className="card-header">待办提醒 <Link to="/reminders" style={{ fontSize: 13, marginLeft: 8 }}>查看全部</Link></div>
            {(data?.upcomingReminders || []).length > 0 ? (
              <table>
                <thead><tr><th>线索</th><th>下次跟进</th><th>负责人</th></tr></thead>
                <tbody>
                  {data?.upcomingReminders?.map((r) => (
                    <tr key={r.id}>
                      <td><Link to={`/clues/${r.id}`}>{r.title}</Link></td>
                      <td>{r.next_followup_at ? new Date(r.next_followup_at).toLocaleDateString("zh-CN") : "-"}</td>
                      <td>{r.owner_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-muted">暂无待办提醒</p>}
          </div>
        </>
      )}
    </div>
  );
}
