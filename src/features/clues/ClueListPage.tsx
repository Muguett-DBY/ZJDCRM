/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";

interface ClueItem {
  id: string;
  title: string;
  company_name: string;
  industry_code: string;
  stage_code: string;
  owner_id: string;
  source_code: string;
  desired_area: number | null;
  expected_landing_at: string | null;
  updated_at: string;
  created_at: string;
}

interface PageData {
  items: ClueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const stageLabels: Record<string, string> = {
  new: "新线索", filed: "已建档", initial_contact: "初步接触",
  needs_confirmed: "需求确认", key_followup: "重点跟进", site_visit: "考察洽谈",
  intent_confirmed: "意向确认", contract_pending: "签约推进", signed: "已签约",
  landed: "已落地", lost: "暂缓/流失",
};

const stageColors: Record<string, string> = {
  new: "badge-primary", filed: "badge-primary", initial_contact: "badge-primary",
  needs_confirmed: "badge-primary", key_followup: "badge-warning",
  site_visit: "badge-warning", intent_confirmed: "badge-warning",
  contract_pending: "badge-warning", signed: "badge-success",
  landed: "badge-success", lost: "badge-danger",
};

export default function ClueListPage() {
  const { t } = useCopy();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const page = parseInt(searchParams.get("page") || "1");
  const stage = searchParams.get("stage") || "";
  const source = searchParams.get("source") || "";
  const search = searchParams.get("search") || "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = { page: String(page), pageSize: "20" };
      if (stage) params.stage = stage;
      if (source) params.source = source;
      if (search) params.search = search;
      const result = await api.get<PageData>("/clues", params);
      setData(result);
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, stage, source, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{t("clue.page.title")}</h1>
        <Link to="/clues/new" className="btn btn-primary">{t("clue.action.create")}</Link>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="filter-search">{t("common.search")}</label>
          <input
            id="filter-search"
            placeholder={`${t("clue.field.title")}/${t("clue.field.company")}`}
            value={search}
            onChange={(e) => updateParam("search", e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="filter-stage">{t("clue.field.stage")}</label>
          <select id="filter-stage" value={stage} onChange={(e) => updateParam("stage", e.target.value)}>
            <option value="">全部阶段</option>
            {Object.entries(stageLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="filter-source">渠道</label>
          <select id="filter-source" value={source} onChange={(e) => updateParam("source", e.target.value)}>
            <option value="">全部渠道</option>
            <option value="activity">活动</option>
            <option value="referral">渠道推荐</option>
            <option value="gov">政府推荐</option>
            <option value="visit">拜访</option>
            <option value="internal">内部转介</option>
          </select>
        </div>
        <button className="btn btn-ghost" onClick={() => setSearchParams(new URLSearchParams())}>重置</button>
      </div>

      {/* Error */}
      {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Empty State */}
      {!loading && data && data.items.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p className="text-muted">暂无招商线索</p>
          <Link to="/clues/new" className="btn btn-primary" style={{ marginTop: 16 }}>新增第一条线索</Link>
        </div>
      )}

      {/* Table */}
      {data && data.items.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t("clue.field.title")}</th>
                <th>{t("clue.field.company")}</th>
                <th>{t("clue.field.stage")}</th>
                <th>渠道</th>
                <th>{t("clue.field.area")}</th>
                <th>预计落位</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((clue) => (
                <tr key={clue.id}>
                  <td><Link to={`/clues/${clue.id}`}>{clue.title}</Link></td>
                  <td>{clue.company_name || "-"}</td>
                  <td><span className={`badge ${stageColors[clue.stage_code] || "badge-primary"}`}>{stageLabels[clue.stage_code] || clue.stage_code}</span></td>
                  <td>{clue.source_code || "-"}</td>
                  <td>{clue.desired_area ? `${clue.desired_area}㎡` : "-"}</td>
                  <td>{clue.expected_landing_at ? new Date(clue.expected_landing_at).toLocaleDateString("zh-CN") : "-"}</td>
                  <td>{new Date(clue.updated_at).toLocaleDateString("zh-CN")}</td>
                  <td>
                    <Link to={`/clues/${clue.id}`} className="btn btn-ghost btn-sm">查看</Link>
                    <Link to={`/clues/${clue.id}/edit`} className="btn btn-ghost btn-sm">{t("clue.action.edit")}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="pagination">
          <span className="pagination-info">共 {data.total} 条</span>
          <button disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>上一页</button>
          {Array.from({ length: Math.min(data.totalPages, 10) }, (_, i) => {
            const p = Math.max(1, Math.min(page - 5, data.totalPages - 9)) + i;
            if (p > data.totalPages) return null;
            return (
              <button key={p} className={p === page ? "active" : ""} onClick={() => updateParam("page", String(p))}>
                {p}
              </button>
            );
          })}
          <button disabled={page >= data.totalPages} onClick={() => updateParam("page", String(page + 1))}>下一页</button>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /><span>加载中...</span></div>}
    </div>
  );
}

