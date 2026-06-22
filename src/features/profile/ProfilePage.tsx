import { useState } from "react";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";
import { useAuth } from "../auth/auth.store";

export default function ProfilePage() {
  const { t } = useCopy();
  const { user, csrfToken } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPassword !== confirmPassword) {
      setMsg({ type: "error", text: "两次密码不一致" });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ type: "error", text: "新密码至少8位" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword }, csrfToken);
      setMsg({ type: "success", text: "密码修改成功，请重新登录" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "修改失败" });
    } finally { setLoading(false); }
  };

  return (
    <div className="page" style={{ maxWidth: 500 }}>
      <h1>{t("nav.profile")}</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">账号信息</div>
        <p>账号：{user?.account}</p>
        <p>显示名：{user?.displayName}</p>
      </div>
      <div className="card">
        <div className="card-header">修改密码</div>
        {msg && <div className={`form-${msg.type === "error" ? "error" : "success"}`} style={{ marginBottom: 8, padding: 8, borderRadius: 4, background: msg.type === "error" ? "#fce8e6" : "#e6f4ea", color: msg.type === "error" ? "#d93025" : "#188038" }}>{msg.text}</div>}
        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-field"><label>当前密码</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
          <div className="form-field"><label>新密码</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} /></div>
          <div className="form-field"><label>确认新密码</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "修改中..." : "修改密码"}</button>
        </form>
      </div>
    </div>
  );
}
