/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";
import AttachmentPanel from "./AttachmentPanel";

interface ClueDetail {
  id: string;
  title: string;
  company_name: string;
  main_business: string;
  industry_code: string;
  stage_code: string;
  desired_area: number | null;
  acquired_at: string | null;
  expected_landing_at: string | null;
  bottleneck: string | null;
  source_code: string | null;
  internal_referral_flag: number;
  financing_flag: number;
  prior_location: string | null;
  lost_reason: string | null;
  fiscal_completion: string | null;
  expected_output: number | null;
  expected_tax: number | null;
  owner_id: string;
  department_id: string | null;
  actual_area: number | null;
  actual_space_id: string | null;
  actual_landing_at: string | null;
  actual_fiscal_completion: string | null;
  created_at: string;
  updated_at: string;
  version: number;

  contacts: any[];
  followups: any[];
  spaces: any[];
  stageHistory: any[];
}

type ProjectForm = {
  title: string;
  companyName: string;
  mainBusiness: string;
  industryCode: string;
  sourceCode: string;
  stageCode: string;
  stageReason: string;
  desiredArea: string;
  acquiredAt: string;
  expectedLandingAt: string;
  bottleneck: string;
  internalReferralFlag: boolean;
  financingFlag: boolean;
  priorLocation: string;
  lostReason: string;
  fiscalCompletion: string;
  expectedOutput: string;
  expectedTax: string;
  actualSpaceId: string;
  actualArea: string;
  actualLandingAt: string;
  actualFiscalCompletion: string;
};

function clueToProjectForm(clue: ClueDetail): ProjectForm {
  return {
    title: clue.title || "", companyName: clue.company_name || "", mainBusiness: clue.main_business || "", industryCode: clue.industry_code || "other",
    sourceCode: clue.source_code || "", stageCode: clue.stage_code || "new", stageReason: "", desiredArea: clue.desired_area?.toString() || "",
    acquiredAt: clue.acquired_at?.slice(0, 10) || "", expectedLandingAt: clue.expected_landing_at?.slice(0, 10) || "", bottleneck: clue.bottleneck || "",
    internalReferralFlag: !!clue.internal_referral_flag, financingFlag: !!clue.financing_flag, priorLocation: clue.prior_location || "",
    lostReason: clue.lost_reason || "", fiscalCompletion: clue.fiscal_completion || "", expectedOutput: clue.expected_output?.toString() || "", expectedTax: clue.expected_tax?.toString() || "",
    actualSpaceId: clue.actual_space_id || "", actualArea: clue.actual_area?.toString() || "", actualLandingAt: clue.actual_landing_at?.slice(0, 10) || "", actualFiscalCompletion: clue.actual_fiscal_completion || "",
  };
}

const stageLabels: Record<string, string> = {
  new: "新线索", filed: "已建档", initial_contact: "初步接触",
  needs_confirmed: "需求确认", key_followup: "重点跟进", site_visit: "考察洽谈",
  intent_confirmed: "意向确认", contract_pending: "签约推进", signed: "已签约",
  landed: "已落地", lost: "暂缓/流失",
};

export default function ClueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [clue, setClue] = useState<ClueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { csrfToken } = useAuth();
  const [contactForm, setContactForm] = useState({ name: "", mobile: "", title: "", isPrimaryDecisionMaker: false });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactEditForm, setContactEditForm] = useState({ name: "", mobile: "", title: "", isPrimaryDecisionMaker: false });
  const [followupForm, setFollowupForm] = useState({ methodCode: "phone", content: "", customerFeedback: "", customerNeed: "", customerPain: "", nextAction: "", nextFollowupAt: "", countsAsVisit: false, countsAsTour: false });
  const [attachments, setAttachments] = useState<any[]>([]);
  const [followupAttachmentIds, setFollowupAttachmentIds] = useState<string[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
  const [editingProject, setEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectForm | null>(null);
  const [savingProject, setSavingProject] = useState(false);

  const fetchClue = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<ClueDetail>(`/clues/${id}`);
      setClue(data);
      setProjectForm(clueToProjectForm(data));
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClue(); }, [fetchClue]);
  useEffect(() => {
    api.get<any>("/spaces", { pageSize: "100" })
      .then((data) => setAvailableSpaces(data.items || []))
      .catch(() => setAvailableSpaces([]));
  }, []);

  const addContact = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await api.post<any>(`/clues/${id}/contacts`, contactForm, csrfToken);
    if (result.duplicate) {
      setError(`手机号已存在：${result.existingName}`);
      return;
    }
    setContactForm({ name: "", mobile: "", title: "", isPrimaryDecisionMaker: false });
    await fetchClue();
  };

  const startContactEdit = (contact: any) => {
    setEditingContactId(contact.id);
    setContactEditForm({ name: contact.name || "", mobile: contact.mobile || "", title: contact.title || "", isPrimaryDecisionMaker: !!contact.is_primary_decision_maker });
  };

  const saveContact = async (contactId: string) => {
    await api.put(`/clues/${id}/contacts/${contactId}`, contactEditForm, csrfToken);
    setEditingContactId(null);
    await fetchClue();
  };

  const deleteContact = async (contactId: string) => {
    if (!window.confirm("确认删除该联系人吗？")) return;
    await api.delete(`/clues/${id}/contacts/${contactId}`, csrfToken);
    await fetchClue();
  };

  const saveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clue || !projectForm) return;
    setSavingProject(true);
    setError("");
    try {
      await api.put(`/clues/${clue.id}`, { ...projectForm, version: clue.version }, csrfToken);
      setEditingProject(false);
      await fetchClue();
    } catch (err: any) {
      setError(err.message || "项目信息保存失败");
    } finally {
      setSavingProject(false);
    }
  };

  const addFollowup = async (event: React.FormEvent) => {
    event.preventDefault();
    await api.post(`/clues/${id}/followups`, { ...followupForm, attachmentIds: followupAttachmentIds }, csrfToken);
    setFollowupForm({ methodCode: "phone", content: "", customerFeedback: "", customerNeed: "", customerPain: "", nextAction: "", nextFollowupAt: "", countsAsVisit: false, countsAsTour: false });
    setFollowupAttachmentIds([]);
    await fetchClue();
  };

  const addSpace = async () => {
    if (!spaceId) return;
    await api.post(`/clues/${id}/spaces`, { spaceId }, csrfToken);
    setSpaceId("");
    await fetchClue();
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>加载中...</span></div>;
  if (error) return <div className="page"><div className="form-error">{error}</div><Link to="/clues" className="btn">返回列表</Link></div>;
  if (!clue) return <div className="page"><p>线索不存在</p><Link to="/clues" className="btn">返回列表</Link></div>;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1>{clue.title}</h1>
          <p className="text-muted">{clue.company_name} · {clue.main_business}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => { setProjectForm(clueToProjectForm(clue)); setEditingProject((value) => !value); }}>编辑项目信息</button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

      {editingProject && projectForm && (
        <form className="card" onSubmit={saveProject} style={{ marginBottom: 16 }}>
          <div className="card-header">项目信息维护</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div className="form-field"><label htmlFor="edit-clue-title">线索名称</label><input id="edit-clue-title" aria-label="编辑线索名称" required value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} /></div>
            <div className="form-field"><label htmlFor="edit-company-name">企业名称</label><input id="edit-company-name" aria-label="编辑企业名称" required value={projectForm.companyName} onChange={(event) => setProjectForm({ ...projectForm, companyName: event.target.value })} /></div>
            <div className="form-field"><label>主营业务</label><input value={projectForm.mainBusiness} onChange={(event) => setProjectForm({ ...projectForm, mainBusiness: event.target.value })} /></div>
            <div className="form-field"><label>行业</label><select value={projectForm.industryCode} onChange={(event) => setProjectForm({ ...projectForm, industryCode: event.target.value })}><option value="medical_devices">医疗器械</option><option value="pharma">医药健康</option><option value="ai">AI/人工智能</option><option value="integrated_circuit">集成电路</option><option value="smart_manufacturing">智能制造</option><option value="other">其他</option></select></div>
            <div className="form-field"><label>渠道 *</label><select required value={projectForm.sourceCode} onChange={(event) => setProjectForm({ ...projectForm, sourceCode: event.target.value })}><option value="">请选择</option><option value="crm_stock">CRM存量</option><option value="company_new_entity">公司自有资源（新主体）</option><option value="government_task">政府领导任务</option><option value="kejinf_referral">科金转介</option><option value="other_referral">其他转介</option><option value="self_developed">自拓</option></select></div>
            <div className="form-field"><label>阶段</label><select value={projectForm.stageCode} onChange={(event) => setProjectForm({ ...projectForm, stageCode: event.target.value })}>{Object.entries(stageLabels).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></div>
            <div className="form-field"><label>需求面积（㎡）</label><input type="number" value={projectForm.desiredArea} onChange={(event) => setProjectForm({ ...projectForm, desiredArea: event.target.value })} /></div>
            <div className="form-field"><label>获取意向时间</label><input type="date" value={projectForm.acquiredAt} onChange={(event) => setProjectForm({ ...projectForm, acquiredAt: event.target.value })} /></div>
            <div className="form-field"><label>预计落位时间</label><input type="date" value={projectForm.expectedLandingAt} onChange={(event) => setProjectForm({ ...projectForm, expectedLandingAt: event.target.value })} /></div>
            <div className="form-field"><label>核心卡点</label><input value={projectForm.bottleneck} onChange={(event) => setProjectForm({ ...projectForm, bottleneck: event.target.value })} /></div>
            <div className="form-field"><label>原办公/生产地</label><input value={projectForm.priorLocation} onChange={(event) => setProjectForm({ ...projectForm, priorLocation: event.target.value })} /></div>
            <div className="form-field"><label>阶段变更原因</label><input required={projectForm.stageCode !== clue.stage_code} value={projectForm.stageReason} onChange={(event) => setProjectForm({ ...projectForm, stageReason: event.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <label><input type="checkbox" checked={projectForm.internalReferralFlag} onChange={(event) => setProjectForm({ ...projectForm, internalReferralFlag: event.target.checked })} /> 内部转介</label>
            <label><input type="checkbox" checked={projectForm.financingFlag} onChange={(event) => setProjectForm({ ...projectForm, financingFlag: event.target.checked })} /> 有融资需求</label>
          </div>
          {projectForm.stageCode === "lost" && <div className="form-field" style={{ marginTop: 12 }}><label>流失原因</label><textarea required value={projectForm.lostReason} onChange={(event) => setProjectForm({ ...projectForm, lostReason: event.target.value })} /></div>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button className="btn btn-primary" type="submit" disabled={savingProject}>{savingProject ? "保存中..." : "保存项目信息"}</button><button className="btn" type="button" onClick={() => setEditingProject(false)} disabled={savingProject}>取消</button></div>
        </form>
      )}

      {/* Info Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">基本信息</div>
          <div style={{ fontSize: 13 }}><strong>阶段：</strong><span className={`badge ${clue.stage_code === "signed" || clue.stage_code === "landed" ? "badge-success" : "badge-primary"}`}>{stageLabels[clue.stage_code]}</span></div>
          <div style={{ fontSize: 13 }}><strong>渠道：</strong>{clue.source_code || "-"}</div>
          <div style={{ fontSize: 13 }}><strong>需求面积：</strong>{clue.desired_area ? `${clue.desired_area}㎡` : "-"}</div>
          <div style={{ fontSize: 13 }}><strong>预计落位：</strong>{clue.expected_landing_at ? new Date(clue.expected_landing_at).toLocaleDateString("zh-CN") : "-"}</div>
          <div style={{ fontSize: 13 }}><strong>卡点：</strong>{clue.bottleneck || "-"}</div>
          <div style={{ fontSize: 13 }}><strong>最新需求：</strong>{(clue as any).current_customer_need || "-"}</div>
          <div style={{ fontSize: 13 }}><strong>最新痛点：</strong>{(clue as any).current_customer_pain || "-"}</div>
        </div>
        <div className="card">
          <div className="card-header">需求与效益</div>
          <div style={{ fontSize: 13 }}><strong>内转：</strong>{clue.internal_referral_flag ? "是" : "否"}</div>
          <div style={{ fontSize: 13 }}><strong>融资需求：</strong>{clue.financing_flag ? "是" : "否"}</div>
          <div style={{ fontSize: 13 }}><strong>原场地：</strong>{clue.prior_location || "-"}</div>
          <div style={{ fontSize: 13 }}><strong>预计产值：</strong>{clue.expected_output ?? "-"}</div>
          <div style={{ fontSize: 13 }}><strong>预计税收：</strong>{clue.expected_tax ?? "-"}</div>
        </div>
        <div className="card">
          <div className="card-header">落地信息</div>
          {clue.stage_code === "landed" ? (
            <>
              <div style={{ fontSize: 13 }}><strong>实际面积：</strong>{clue.actual_area ? `${clue.actual_area}㎡` : "-"}</div>
              <div style={{ fontSize: 13 }}><strong>落地日期：</strong>{clue.actual_landing_at ? new Date(clue.actual_landing_at).toLocaleDateString("zh-CN") : "-"}</div>
              <div style={{ fontSize: 13 }}><strong>财源情况：</strong>{clue.actual_fiscal_completion || "-"}</div>
            </>
          ) : clue.stage_code === "lost" ? (
            <div style={{ fontSize: 13 }}><strong>流失原因：</strong>{clue.lost_reason || "-"}</div>
          ) : (
            <p className="text-muted">尚未落地</p>
          )}
        </div>
      </div>

      {/* Contacts */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">联系人 ({clue.contacts?.length || 0})</div>
        <form onSubmit={addContact} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input aria-label="联系人姓名" placeholder="姓名" required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
          <input aria-label="联系人手机号" placeholder="手机号" required value={contactForm.mobile} onChange={(event) => setContactForm({ ...contactForm, mobile: event.target.value })} />
          <input aria-label="联系人职务" placeholder="职务" value={contactForm.title} onChange={(event) => setContactForm({ ...contactForm, title: event.target.value })} />
          <label><input type="checkbox" checked={contactForm.isPrimaryDecisionMaker} onChange={(event) => setContactForm({ ...contactForm, isPrimaryDecisionMaker: event.target.checked })} /> 决策人</label>
          <button className="btn btn-sm" type="submit">添加联系人</button>
        </form>
        {clue.contacts?.length > 0 ? (
          <table>
            <thead><tr><th>姓名</th><th>手机</th><th>职务</th><th>决策人</th><th>操作</th></tr></thead>
            <tbody>
              {clue.contacts.map((c: any) => (
                <tr key={c.id}>
                  {editingContactId === c.id ? <>
                    <td><input aria-label="编辑联系人姓名" required value={contactEditForm.name} onChange={(event) => setContactEditForm({ ...contactEditForm, name: event.target.value })} /></td>
                    <td><input aria-label="编辑联系人手机号" required value={contactEditForm.mobile} onChange={(event) => setContactEditForm({ ...contactEditForm, mobile: event.target.value })} /></td>
                    <td><input aria-label="编辑联系人职务" value={contactEditForm.title} onChange={(event) => setContactEditForm({ ...contactEditForm, title: event.target.value })} /></td>
                    <td><input aria-label="编辑联系人决策人" type="checkbox" checked={contactEditForm.isPrimaryDecisionMaker} onChange={(event) => setContactEditForm({ ...contactEditForm, isPrimaryDecisionMaker: event.target.checked })} /></td>
                    <td><button className="btn btn-ghost btn-sm" type="button" onClick={() => saveContact(c.id)}>保存联系人</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditingContactId(null)}>取消</button></td>
                  </> : <>
                    <td>{c.name}</td>
                    <td>{c.mobile}</td>
                    <td>{c.title || "-"}</td>
                    <td>{c.is_primary_decision_maker ? "★" : ""}</td>
                    <td><button className="btn btn-ghost btn-sm" type="button" onClick={() => startContactEdit(c)}>编辑联系人</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => deleteContact(c.id)}>删除</button></td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">暂无联系人</p>
        )}
      </div>

      <AttachmentPanel clueId={clue.id} csrfToken={csrfToken} onItemsChange={setAttachments} />

      {/* Matched Spaces */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">备选空间 ({clue.spaces?.length || 0})</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select aria-label="选择备选空间" value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>
            <option value="">选择备选空间</option>
            {availableSpaces.filter((space) => !clue.spaces.some((matched) => matched.id === space.id)).map((space) => <option key={space.id} value={space.id}>{space.park_name} / {space.building_name} / {space.name}</option>)}
          </select>
          <button className="btn btn-sm" disabled={!spaceId} onClick={addSpace}>添加空间</button>
        </div>
        {clue.spaces?.length > 0 ? (
          <table>
            <thead><tr><th>空间</th><th>优先级</th><th>备注</th></tr></thead>
            <tbody>
              {clue.spaces.map((s: any) => (
                <tr key={s.id}>
                  <td><Link to={`/spaces/${s.id}`}>{s.name}</Link></td>
                  <td>{s.match_rank}</td>
                  <td>{s.match_reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (<p className="text-muted">暂无匹配空间</p>)}
      </div>

      {/* Followups / Timeline */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">跟进时间线</div>
        <form onSubmit={addFollowup} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, marginBottom: 12 }}>
          <select aria-label="跟进方式" value={followupForm.methodCode} onChange={(event) => setFollowupForm({ ...followupForm, methodCode: event.target.value })}>
            <option value="phone">电话</option><option value="wechat">微信</option><option value="visit">拜访</option><option value="meeting">会议</option><option value="email">邮件</option>
          </select>
          <textarea aria-label="跟进内容" placeholder="跟进内容" required value={followupForm.content} onChange={(event) => setFollowupForm({ ...followupForm, content: event.target.value })} />
          <input aria-label="客户反馈" placeholder="客户反馈" value={followupForm.customerFeedback} onChange={(event) => setFollowupForm({ ...followupForm, customerFeedback: event.target.value })} />
          <input aria-label="客户需求" placeholder="客户需求（更新摘要）" value={followupForm.customerNeed} onChange={(event) => setFollowupForm({ ...followupForm, customerNeed: event.target.value })} />
          <input aria-label="客户痛点" placeholder="客户痛点（更新摘要）" value={followupForm.customerPain} onChange={(event) => setFollowupForm({ ...followupForm, customerPain: event.target.value })} />
          <input aria-label="下一步动作" placeholder="下一步动作" value={followupForm.nextAction} onChange={(event) => setFollowupForm({ ...followupForm, nextAction: event.target.value })} />
          <input aria-label="下次跟进时间" type="datetime-local" value={followupForm.nextFollowupAt} onChange={(event) => setFollowupForm({ ...followupForm, nextFollowupAt: event.target.value })} />
          <label><input type="checkbox" checked={followupForm.countsAsVisit} onChange={(event) => setFollowupForm({ ...followupForm, countsAsVisit: event.target.checked })} /> 计入客户拜访</label>
          <label><input type="checkbox" checked={followupForm.countsAsTour} onChange={(event) => setFollowupForm({ ...followupForm, countsAsTour: event.target.checked })} /> 计入园区带看</label>
          {(followupForm.countsAsVisit || followupForm.countsAsTour) && <div style={{ gridColumn: "1 / -1" }}><small>计入拜访/带看必须勾选至少一个已上传附件：</small>{attachments.map((attachment) => <label key={attachment.id} style={{ marginLeft: 12 }}><input type="checkbox" checked={followupAttachmentIds.includes(attachment.id)} onChange={(event) => setFollowupAttachmentIds((ids) => event.target.checked ? [...ids, attachment.id] : ids.filter((item) => item !== attachment.id))} /> {attachment.original_file_name}</label>)}</div>}
          <button className="btn btn-sm" type="submit">添加跟进</button>
        </form>
        {clue.followups?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clue.followups.map((f: any) => (
              <div key={f.id} style={{ padding: 12, border: "1px solid var(--color-border-light)", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>
                  {new Date(f.followup_at).toLocaleString("zh-CN")} · {f.method_code}
                </div>
                <div>{f.content}</div>
                {f.customer_feedback && <div style={{ fontSize: 13, marginTop: 4, color: "var(--color-text-secondary)" }}>客户反馈：{f.customer_feedback}</div>}
                {f.customer_need && <div style={{ fontSize: 13, marginTop: 4 }}>客户需求：{f.customer_need}</div>}
                {f.customer_pain && <div style={{ fontSize: 13, marginTop: 4 }}>客户痛点：{f.customer_pain}</div>}
                {(f.counts_as_visit || f.counts_as_tour) && <div style={{ fontSize: 13, marginTop: 4 }}>计入：{[f.counts_as_visit && "客户拜访", f.counts_as_tour && "园区带看"].filter(Boolean).join("、")}</div>}
                {f.next_action && <div style={{ fontSize: 13, marginTop: 4 }}>下一步：{f.next_action}</div>}
              </div>
            ))}
          </div>
        ) : (<p className="text-muted">暂无跟进记录</p>)}
      </div>

      {/* Stage History */}
      <div className="card">
        <div className="card-header">阶段变更历史</div>
        {clue.stageHistory?.length > 0 ? (
          <table>
            <thead><tr><th>时间</th><th>从</th><th>到</th><th>原因</th></tr></thead>
            <tbody>
              {clue.stageHistory.map((h: any) => (
                <tr key={h.id}>
                  <td>{new Date(h.changed_at).toLocaleString("zh-CN")}</td>
                  <td>{stageLabels[h.from_stage_code] || h.from_stage_code}</td>
                  <td>{stageLabels[h.to_stage_code] || h.to_stage_code}</td>
                  <td>{h.reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (<p className="text-muted">暂无阶段变更</p>)}
      </div>
    </div>
  );
}

