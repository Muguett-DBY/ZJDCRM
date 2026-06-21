import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

interface FormData {
  title: string;
  companyName: string;
  mainBusiness: string;
  industryCode: string;
  desiredArea: string;
  acquiredAt: string;
  expectedLandingAt: string;
  stageCode: string;
  bottleneck: string;
  sourceCode: string;
  internalReferralFlag: boolean;
  financingFlag: boolean;
  priorLocation: string;
  lostReason: string;
  fiscalCompletion: string;
  expectedOutput: string;
  expectedTax: string;
  stageReason: string;
  version?: number;
}

const defaultForm: FormData = {
  title: "", companyName: "", mainBusiness: "", industryCode: "other",
  desiredArea: "", acquiredAt: new Date().toISOString().split("T")[0],
  expectedLandingAt: "", stageCode: "new", bottleneck: "", sourceCode: "",
  internalReferralFlag: false, financingFlag: false,
  priorLocation: "", lostReason: "", fiscalCompletion: "",
  expectedOutput: "", expectedTax: "", stageReason: "",
};

export default function ClueFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { csrfToken } = useAuth();
  const [form, setForm] = useState<FormData>(defaultForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api.get<any>(`/clues/${id}`).then((data) => {
      setForm({
        title: data.title || "",
        companyName: data.company_name || "",
        mainBusiness: data.main_business || "",
        industryCode: data.industry_code || "other",
        desiredArea: data.desired_area?.toString() || "",
        acquiredAt: data.acquired_at?.split("T")[0] || "",
        expectedLandingAt: data.expected_landing_at?.split("T")[0] || "",
        stageCode: data.stage_code || "new",
        bottleneck: data.bottleneck || "",
        sourceCode: data.source_code || "",
        internalReferralFlag: !!data.internal_referral_flag,
        financingFlag: !!data.financing_flag,
        priorLocation: data.prior_location || "",
        lostReason: data.lost_reason || "",
        fiscalCompletion: data.fiscal_completion || "",
        expectedOutput: data.expected_output?.toString() || "",
        expectedTax: data.expected_tax?.toString() || "",
        stageReason: "",
        version: data.version,
      });
      setLoading(false);
    }).catch(() => { setError("加载失败"); setLoading(false); });
  }, [id]);

  const set = (key: keyof FormData, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await api.put(`/clues/${id}`, { ...form, version: form.version }, csrfToken);
        navigate(`/clues/${id}`);
      } else {
        const result = await api.post<{ id: string }>("/clues", form, csrfToken);
        navigate(`/clues/${result.id}`);
      }
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>加载中...</span></div>;

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <h1>{isEdit ? "编辑线索" : "新增线索"}</h1>
      {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Basic Info */}
        <div className="card">
          <div className="card-header">基本信息</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-field"><label>线索名称 *</label><input value={form.title} onChange={(e) => set("title", e.target.value)} required /></div>
            <div className="form-field"><label>企业名称 *</label><input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} required /></div>
            <div className="form-field"><label>主营业务</label><input value={form.mainBusiness} onChange={(e) => set("mainBusiness", e.target.value)} /></div>
            <div className="form-field">
              <label>行业</label>
              <select value={form.industryCode} onChange={(e) => set("industryCode", e.target.value)}>
                <option value="medical_devices">医疗器械</option>
                <option value="pharma">医药健康</option>
                <option value="ai">AI/人工智能</option>
                <option value="integrated_circuit">集成电路</option>
                <option value="smart_manufacturing">智能制造</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="form-field"><label>渠道来源</label>
              <select value={form.sourceCode} onChange={(e) => set("sourceCode", e.target.value)}>
                <option value="">请选择</option><option value="activity">活动</option>
                <option value="referral">渠道推荐</option><option value="gov">政府推荐</option>
                <option value="visit">拜访</option><option value="internal">内部转介</option>
              </select>
            </div>
            <div className="form-field"><label>阶段</label>
              <select value={form.stageCode} onChange={(e) => set("stageCode", e.target.value)}>
                <option value="new">新线索</option><option value="filed">已建档</option>
                <option value="initial_contact">初步接触</option><option value="needs_confirmed">需求确认</option>
                <option value="key_followup">重点跟进</option><option value="site_visit">考察洽谈</option>
                <option value="intent_confirmed">意向确认</option><option value="contract_pending">签约推进</option>
                <option value="signed">已签约</option><option value="landed">已落地</option>
                <option value="lost">暂缓/流失</option>
              </select>
            </div>
          </div>
          {(form.stageCode !== "new" && isEdit) && (
            <div className="form-field" style={{ marginTop: 8 }}>
              <label>阶段变更原因</label>
              <textarea value={form.stageReason} onChange={(e) => set("stageReason", e.target.value)} />
            </div>
          )}
        </div>

        {/* Requirements */}
        <div className="card">
          <div className="card-header">空间与效益需求</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-field"><label>需求面积 (㎡)</label><input type="number" value={form.desiredArea} onChange={(e) => set("desiredArea", e.target.value)} /></div>
            <div className="form-field"><label>获取日期</label><input type="date" value={form.acquiredAt} onChange={(e) => set("acquiredAt", e.target.value)} /></div>
            <div className="form-field"><label>预计落位日期</label><input type="date" value={form.expectedLandingAt} onChange={(e) => set("expectedLandingAt", e.target.value)} /></div>
            <div className="form-field"><label>核心卡点</label><input value={form.bottleneck} onChange={(e) => set("bottleneck", e.target.value)} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            <div className="form-field"><label>预计产值</label><input type="number" value={form.expectedOutput} onChange={(e) => set("expectedOutput", e.target.value)} /></div>
            <div className="form-field"><label>预计税收</label><input type="number" value={form.expectedTax} onChange={(e) => set("expectedTax", e.target.value)} /></div>
          </div>
        </div>

        {/* Flags */}
        <div className="card">
          <div className="card-header">附加信息</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={form.internalReferralFlag} onChange={(e) => set("internalReferralFlag", e.target.checked)} />内部转介
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={form.financingFlag} onChange={(e) => set("financingFlag", e.target.checked)} />有融资需求
            </label>
          </div>
          <div className="form-field" style={{ marginTop: 8 }}>
            <label>原办公/生产地</label>
            <input value={form.priorLocation} onChange={(e) => set("priorLocation", e.target.value)} />
          </div>
        </div>

        {/* Landing/Lost */}
        {form.stageCode === "lost" && (
          <div className="card">
            <div className="card-header">流失信息</div>
            <div className="form-field"><label>流失原因 *</label><textarea value={form.lostReason} onChange={(e) => set("lostReason", e.target.value)} required /></div>
          </div>
        )}
        {form.stageCode === "landed" && (
          <div className="card">
            <div className="card-header">落地信息</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-field"><label>实际面积 *</label><input type="number" value={form.fiscalCompletion} onChange={(e) => set("fiscalCompletion", e.target.value)} /></div>
              <div className="form-field"><label>财源完成情况</label><input value={form.fiscalCompletion} onChange={(e) => set("fiscalCompletion", e.target.value)} /></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)} disabled={saving}>取消</button>
        </div>
      </form>
    </div>
  );
}
