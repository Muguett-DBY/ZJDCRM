/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

export default function SystemSettingsPage() {
  const { csrfToken } = useAuth();
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const fetch = async () => {
    setLoading(true);
    try { setSettings(await api.get<any[]>("/admin/settings")); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const [values, setValues] = useState<Record<string, string>>({});

  const save = async () => {
    const entries = Object.entries(values).map(([key, value]) => ({ key, value }));
    await api.put("/admin/settings", entries, csrfToken);
    setMsg("保存成功");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="page">
      <h1>系统设置</h1>
      {msg && <div style={{ padding: 8, background: "#e6f4ea", color: "#188038", borderRadius: 4, marginBottom: 8 }}>{msg}</div>}
      {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : (
        <div className="card">
          <div className="card-header">网站设置</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <div className="form-field"><label>网站名称</label><input value={values["site_name"] || settings.find((s: any) => s.setting_key === "site_name")?.setting_value || ""} onChange={(e) => setValues({ ...values, site_name: e.target.value })} /></div>
            <div className="form-field"><label>登录页文案</label><input value={values["login_text"] || settings.find((s: any) => s.setting_key === "login_text")?.setting_value || ""} onChange={(e) => setValues({ ...values, login_text: e.target.value })} /></div>
            <div className="form-field"><label>系统公告</label><textarea value={values["announcement"] || settings.find((s: any) => s.setting_key === "announcement")?.setting_value || ""} onChange={(e) => setValues({ ...values, announcement: e.target.value })} /></div>
          </div>
          <button className="btn btn-primary" onClick={save}>保存设置</button>
        </div>
      )}
    </div>
  );
}

