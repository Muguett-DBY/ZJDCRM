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
  owner_id: string | null;
  owner_name: string | null;
  source_code: string;
  desired_area: number | null;
  acquired_at: string | null;
  expected_landing_at: string | null;
  bottleneck: string | null;
  financing_flag: number;
  prior_location: string | null;
  tag_names: string | null;
  updated_at: string;
  created_at: string;
}

interface BoardSummary {
  total: number;
  reserveStatusTags: Record<string, number>;
  tagCounts: Array<{ name: string; total: number }>;
}

interface PageData {
  items: ClueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary?: BoardSummary;
}

interface AssignableUser {
  id: string;
  display_name: string;
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

const sourceLabels: Record<string, string> = {
  activity: "活动",
  referral: "渠道推荐",
  gov: "政府推荐",
  visit: "拜访",
  internal: "内部转介",
};

const industryLabels: Record<string, string> = {
  medical_devices: "医疗器械",
  pharma: "医药健康",
  ai: "AI/人工智能",
  integrated_circuit: "集成电路",
  smart_manufacturing: "智能制造",
  other: "其他",
};

const commonTags = ["近两周新增", "重点在签约", "无跟进价值", "已签约", "客户储备", "短期督办", "重点客户", "会招"];

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString("zh-CN") : "-";
}

export default function ClueListPage() {
  const { t } = useCopy();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<PageData | null>(null);
  const [owners, setOwners] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const page = parseInt(searchParams.get("page") || "1");
  const stage = searchParams.get("stage") || "";
  const source = searchParams.get("source") || "";
  const industry = searchParams.get("industry") || "";
  const tag = searchParams.get("tag") || "";
  const owner = searchParams.get("owner") || "";
  const acquiredFrom = searchParams.get("acquiredFrom") || "";
  const acquiredTo = searchParams.get("acquiredTo") || "";
  const expectedFrom = searchParams.get("expectedFrom") || "";
  const expectedTo = searchParams.get("expectedTo") || "";
  const updatedFrom = searchParams.get("updatedFrom") || "";
  const updatedTo = searchParams.get("updatedTo") || "";
  const areaMin = searchParams.get("areaMin") || "";
  const areaMax = searchParams.get("areaMax") || "";
  const search = searchParams.get("search") || "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = { page: String(page), pageSize: "20" };
      if (stage) params.stage = stage;
      if (source) params.source = source;
      if (industry) params.industry = industry;
      if (tag) params.tag = tag;
      if (owner) params.owner = owner;
      if (acquiredFrom) params.acquiredFrom = acquiredFrom;
      if (acquiredTo) params.acquiredTo = acquiredTo;
      if (expectedFrom) params.expectedFrom = expectedFrom;
      if (expectedTo) params.expectedTo = expectedTo;
      if (updatedFrom) params.updatedFrom = updatedFrom;
      if (updatedTo) params.updatedTo = updatedTo;
      if (areaMin) params.areaMin = areaMin;
      if (areaMax) params.areaMax = areaMax;
      if (search) params.search = search;
      const result = await api.get<PageData>("/clues", params);
      setData(result);
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, stage, source, industry, tag, owner, acquiredFrom, acquiredTo, expectedFrom, expectedTo, updatedFrom, updatedTo, areaMin, areaMax, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    api.get<AssignableUser[]>("/users/assignable").then(setOwners).catch(() => setOwners([]));
  }, []);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  };

  const tagOptions = [...new Set([...commonTags, ...(data?.summary?.tagCounts || []).map((item) => item.name)])];

  return (
    <div className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{t("clue.page.title")}</h1>
        <Link to="/clues/new" className="btn btn-primary">{t("clue.action.create")}</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">线索看板</div>
        <div className="stats-grid">
          <div className="stat-card"><span className="stat-value">{data?.summary?.total ?? data?.total ?? 0}</span><span className="stat-label">当前结果</span></div>
          {commonTags.slice(0, 4).map((name) => (
            <button key={name} className="stat-card" style={{ textAlign: "left", border: "none", cursor: "pointer" }} onClick={() => updateParam("tag", name)}>
              <span className="stat-value">{data?.summary?.reserveStatusTags?.[name] || 0}</span>
              <span className="stat-label">{name}</span>
            </button>
          ))}
        </div>
        {data?.summary?.tagCounts?.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {data.summary.tagCounts.slice(0, 12).map((item) => (
              <button key={item.name} className="badge badge-primary" style={{ border: "none", cursor: "pointer" }} onClick={() => updateParam("tag", item.name)}>
                {item.name} {item.total}
              </button>
            ))}
          </div>
        ) : null}
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
            {Object.entries(sourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="filter-industry">行业</label>
          <select id="filter-industry" value={industry} onChange={(e) => updateParam("industry", e.target.value)}>
            <option value="">全部行业</option>
            {Object.entries(industryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="filter-tag">标签</label>
          <select id="filter-tag" value={tag} onChange={(e) => updateParam("tag", e.target.value)}>
            <option value="">全部标签</option>
            {tagOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="filter-owner">负责人</label>
          <select id="filter-owner" value={owner} onChange={(e) => updateParam("owner", e.target.value)}>
            <option value="">全部负责人</option>
            {owners.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="filter-acquired-from">获取意向起</label>
          <input id="filter-acquired-from" type="date" value={acquiredFrom} onChange={(e) => updateParam("acquiredFrom", e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-acquired-to">获取意向止</label>
          <input id="filter-acquired-to" type="date" value={acquiredTo} onChange={(e) => updateParam("acquiredTo", e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-expected-from">预计落位起</label>
          <input id="filter-expected-from" type="date" value={expectedFrom} onChange={(e) => updateParam("expectedFrom", e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-expected-to">预计落位止</label>
          <input id="filter-expected-to" type="date" value={expectedTo} onChange={(e) => updateParam("expectedTo", e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-updated-from">更新起</label>
          <input id="filter-updated-from" type="date" value={updatedFrom} onChange={(e) => updateParam("updatedFrom", e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-updated-to">更新止</label>
          <input id="filter-updated-to" type="date" value={updatedTo} onChange={(e) => updateParam("updatedTo", e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-area-min">面积下限</label>
          <input id="filter-area-min" type="number" min="0" value={areaMin} onChange={(e) => updateParam("areaMin", e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-area-max">面积上限</label>
          <input id="filter-area-max" type="number" min="0" value={areaMax} onChange={(e) => updateParam("areaMax", e.target.value)} />
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
                <th>标签</th>
                <th>行业</th>
                <th>渠道</th>
                <th>负责人</th>
                <th>{t("clue.field.area")}</th>
                <th>获取意向</th>
                <th>预计落位</th>
                <th>核心卡点</th>
                <th>原办公地</th>
                <th>融资</th>
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
                  <td>{clue.tag_names ? clue.tag_names.split("、").map((name) => <span key={name} className="badge badge-primary" style={{ marginRight: 4 }}>{name}</span>) : "-"}</td>
                  <td>{industryLabels[clue.industry_code] || clue.industry_code || "-"}</td>
                  <td>{sourceLabels[clue.source_code] || clue.source_code || "-"}</td>
                  <td>{clue.owner_name || "未分配"}</td>
                  <td>{clue.desired_area ? `${clue.desired_area}㎡` : "-"}</td>
                  <td>{formatDate(clue.acquired_at)}</td>
                  <td>{formatDate(clue.expected_landing_at)}</td>
                  <td>{clue.bottleneck || "-"}</td>
                  <td>{clue.prior_location || "-"}</td>
                  <td>{clue.financing_flag ? "是" : "否"}</td>
                  <td>{formatDate(clue.updated_at)}</td>
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

