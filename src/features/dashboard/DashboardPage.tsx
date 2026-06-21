import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, PieChart, FunnelChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { api } from "../../lib/api";

echarts.use([BarChart, PieChart, FunnelChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface DashboardData {
  newClues: number;
  stageDistribution: { stage_code: string; total: number }[];
  sourceDistribution: { source_code: string; total: number }[];
  signedCount: number;
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

const funnelStages = ["new", "filed", "initial_contact", "needs_confirmed", "key_followup", "site_visit", "intent_confirmed", "contract_pending", "signed", "landed"];

export default function DashboardPage() {
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

  if (loading && !data) return <div className="loading-screen"><div className="spinner" /><span>加载中...</span></div>;

  const stageData = (data?.stageDistribution || []).map((s) => ({
    name: stageLabels[s.stage_code] || s.stage_code,
    value: s.total,
  }));

  const sourceData = (data?.sourceDistribution || []).map((s) => ({
    name: s.source_code, value: s.total,
  }));

  const funnelData = funnelStages.map((code) => {
    const found = data?.stageDistribution?.find((s) => s.stage_code === code);
    return { name: stageLabels[code] || code, value: found?.total || 0 };
  });

  const spaceStatusData = (data?.spaceStatus || []).map((s) => ({
    name: s.status_code, value: s.total,
  }));

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>招商看板</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-field" style={{ width: 140 }} />
          <span style={{ alignSelf: "center" }}>至</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-field" style={{ width: 140 }} />
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-value">{data?.newClues || 0}</div><div className="stat-label">新增线索</div></div>
        <div className="stat-card"><div className="stat-value">{data?.signedCount || 0}</div><div className="stat-label">已签约</div></div>
        <div className="stat-card"><div className="stat-value">{data?.landedCount || 0}</div><div className="stat-label">已落地</div></div>
        <div className="stat-card"><div className="stat-value">{data?.expectedArea ? `${data.expectedArea}㎡` : "-"}</div><div className="stat-label">预计面积</div></div>
        <div className="stat-card"><div className="stat-value">{data?.expectedOutput ?? "-"}</div><div className="stat-label">预计产值</div></div>
        <div className="stat-card"><div className="stat-value">{data?.expectedTax ?? "-"}</div><div className="stat-label">预计税收</div></div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Stage Distribution Pie */}
        <div className="card">
          <div className="card-header">阶段分布</div>
          <ReactEChartsCore
            echarts={echarts}
            option={{
              tooltip: { trigger: "item" },
              series: [{
                type: "pie", radius: ["30%", "60%"],
                data: stageData.length > 0 ? stageData : [{ name: "暂无数据", value: 0 }],
                label: { show: true, formatter: "{b}: {c}" },
              }],
            }}
            style={{ height: 300 }}
          />
        </div>

        {/* Funnel */}
        <div className="card">
          <div className="card-header">招商漏斗</div>
          <ReactEChartsCore
            echarts={echarts}
            option={{
              tooltip: { trigger: "item" },
              series: [{
                type: "funnel", left: "10%", right: "10%",
                data: funnelData.filter((d) => d.value > 0),
                label: { show: true, formatter: "{b}: {c}" },
              }],
            }}
            style={{ height: 300 }}
          />
        </div>
      </div>

      {/* Reminders */}
      <div className="card" style={{ marginBottom: 16 }}>
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
        ) : (<p className="text-muted">暂无待办提醒</p>)}
      </div>

      {loading && <div style={{ textAlign: "center", color: "var(--color-text-muted)" }}>刷新中...</div>}
    </div>
  );
}
