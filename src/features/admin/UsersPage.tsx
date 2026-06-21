/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";

interface User {
  id: string; account: string; display_name: string; mobile: string | null;
  email: string | null; department_id: string | null; department_name: string | null;
  status: string; is_super_admin: number; last_login_at: string | null;
}

export default function UsersPage() {
  const { csrfToken } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ account: "", displayName: "", password: "", mobile: "", departmentId: "", status: "active", isSuperAdmin: false });
  const [msg, setMsg] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: User[] }>("/admin/users");
      setUsers(data.items);
    } catch { setMsg("加载失败"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/admin/users", form, csrfToken);
      setShowForm(false);
      setForm({ account: "", displayName: "", password: "", mobile: "", departmentId: "", status: "active", isSuperAdmin: false });
      fetchUsers();
    } catch (err: any) { setMsg(err.message); }
  };

  const toggleStatus = async (user: User) => {
    try {
      await api.put(`/admin/users/${user.id}`, { ...user, status: user.status === "active" ? "disabled" : "active" }, csrfToken);
      fetchUsers();
    } catch (err: any) { setMsg(err.message); }
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>员工管理</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? "取消" : "新增员工"}</button>
      </div>
      {msg && <div className="form-error" style={{ marginBottom: 8 }}>{msg}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">新增员工</div>
          <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="form-field"><label>账号 *</label><input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} required /></div>
            <div className="form-field"><label>姓名 *</label><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></div>
            <div className="form-field"><label>密码</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="默认 changeme123" /></div>
            <div className="form-field"><label>手机</label><input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div className="form-field"><label>部门ID</label><input value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} /></div>
            <div className="form-field" style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <label><input type="checkbox" checked={form.isSuperAdmin} onChange={(e) => setForm({ ...form, isSuperAdmin: e.target.checked })} /> 超级管理员</label>
            </div>
            <button type="submit" className="btn btn-primary">保存</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>账号</th><th>姓名</th><th>手机</th><th>部门</th><th>状态</th><th>超管</th><th>最后登录</th><th>操作</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.account}</td><td>{u.display_name}</td><td>{u.mobile || "-"}</td>
                  <td>{u.department_name || "-"}</td>
                  <td><span className={`badge ${u.status === "active" ? "badge-success" : "badge-danger"}`}>{u.status === "active" ? "启用" : "禁用"}</span></td>
                  <td>{u.is_super_admin ? "是" : "-"}</td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString("zh-CN") : "-"}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(u)}>
                      {u.status === "active" ? "禁用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

