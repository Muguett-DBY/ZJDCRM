/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../auth/auth.store";
import { useCopy } from "../../lib/copy-provider";

interface User {
  id: string; account: string; display_name: string; mobile: string | null;
  email: string | null; department_id: string | null; department_name: string | null;
  status: string; is_super_admin: number; last_login_at: string | null; role_ids: string | null;
}

export default function UsersPage() {
  const { t } = useCopy();
  const { csrfToken } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ account: "", displayName: "", password: "", mobile: "", departmentId: "", status: "active" });
  const [msg, setMsg] = useState("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", mobile: "", email: "", departmentId: "", status: "active" });
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [resetPassword, setResetPassword] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: User[] }>("/admin/users");
      setUsers(data.items);
      const [departmentData, roleData] = await Promise.all([
        api.get<any[]>("/admin/departments"),
        api.get<any[]>("/admin/roles"),
      ]);
      setDepartments(departmentData);
      setRoles(roleData);
    } catch { setMsg("加载失败"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/admin/users", { ...form, roleIds }, csrfToken);
      setShowForm(false);
      setForm({ account: "", displayName: "", password: "", mobile: "", departmentId: "", status: "active" });
      setRoleIds([]);
      fetchUsers();
    } catch (err: any) { setMsg(err.message); }
  };

  const toggleStatus = async (user: User) => {
    try {
      await api.put(`/admin/users/${user.id}`, { status: user.status === "active" ? "disabled" : "active" }, csrfToken);
      fetchUsers();
    } catch (err: any) { setMsg(err.message); }
  };

  const startEdit = (user: User) => {
    setEditing(user);
    setEditForm({
      displayName: user.display_name,
      mobile: user.mobile || "",
      email: user.email || "",
      departmentId: user.department_id || "",
      status: user.status,
    });
    setEditRoleIds(user.role_ids ? user.role_ids.split(",").filter(Boolean) : []);
    setResetPassword("");
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    try {
      await api.put(`/admin/users/${editing.id}`, { ...editForm, roleIds: editRoleIds }, csrfToken);
      setEditing(null);
      await fetchUsers();
    } catch (err: any) { setMsg(err.message); }
  };

  const submitPasswordReset = async () => {
    if (!editing || resetPassword.length < 8) {
      setMsg("新密码至少需要 8 位");
      return;
    }
    try {
      await api.post(`/admin/users/${editing.id}/reset-password`, { newPassword: resetPassword }, csrfToken);
      setResetPassword("");
      setMsg("密码已重置，员工需要使用新密码重新登录");
    } catch (err: any) { setMsg(err.message); }
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>{t("admin.users")}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? "取消" : "新增员工"}</button>
      </div>
      {msg && <div className="form-error" style={{ marginBottom: 8 }}>{msg}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">新增员工</div>
          <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="form-field"><label htmlFor="new-user-account">账号 *</label><input id="new-user-account" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} required /></div>
            <div className="form-field"><label htmlFor="new-user-name">姓名 *</label><input id="new-user-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></div>
            <div className="form-field"><label htmlFor="new-user-password">初始密码 *</label><input id="new-user-password" required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="至少 8 位" /></div>
            <div className="form-field"><label htmlFor="new-user-mobile">手机</label><input id="new-user-mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div className="form-field"><label htmlFor="new-user-department">部门</label><select id="new-user-department" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}><option value="">未分配</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
            <div className="form-field"><label>角色</label>{roles.map((role) => <label key={role.id} style={{ display: "block" }}><input type="checkbox" checked={roleIds.includes(role.id)} onChange={(event) => setRoleIds(event.target.checked ? [...roleIds, role.id] : roleIds.filter((id) => id !== role.id))} /> {role.name}</label>)}</div>
            <button type="submit" className="btn btn-primary">保存</button>
          </form>
        </div>
      )}

      {editing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">编辑员工：{editing.account}</div>
          <form onSubmit={saveEdit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="form-field"><label htmlFor="edit-user-name">编辑姓名 *</label><input id="edit-user-name" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} required /></div>
            <div className="form-field"><label htmlFor="edit-user-mobile">编辑手机</label><input id="edit-user-mobile" value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} /></div>
            <div className="form-field"><label htmlFor="edit-user-email">编辑邮箱</label><input id="edit-user-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div className="form-field"><label htmlFor="edit-user-department">编辑部门</label><select id="edit-user-department" value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}><option value="">未分配</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
            <div className="form-field"><label htmlFor="edit-user-status">状态</label><select id="edit-user-status" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}><option value="active">启用</option><option value="disabled">禁用</option></select></div>
            <div className="form-field"><label>角色</label>{roles.map((role) => <label key={role.id} style={{ display: "block" }}><input type="checkbox" checked={editRoleIds.includes(role.id)} onChange={(event) => setEditRoleIds(event.target.checked ? [...editRoleIds, role.id] : editRoleIds.filter((id) => id !== role.id))} /> {role.name}</label>)}</div>
            <button type="submit" className="btn btn-primary">保存修改</button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>取消</button>
          </form>
          <div className="form-field" style={{ marginTop: 12 }}><label htmlFor="reset-user-password">重置密码</label><div style={{ display: "flex", gap: 8 }}><input id="reset-user-password" type="password" minLength={8} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="至少 8 位新密码" /><button type="button" className="btn" onClick={submitPasswordReset}>重置员工密码</button></div></div>
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
                    {u.is_super_admin ? "-" : <><button className="btn btn-ghost btn-sm" onClick={() => startEdit(u)}>编辑</button><button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(u)}>{u.status === "active" ? "禁用" : "启用"}</button></>}
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

