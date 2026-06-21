const API_BASE = "/api";

interface SessionUser {
  id: string;
  account: string;
  displayName: string;
  isSuperAdmin: boolean;
  canManageSystem: boolean;
  departmentId: string | null;
}

interface AuthResponse {
  ok: boolean;
  data?: { user: SessionUser; csrfToken: string };
  error?: { code: string; message: string };
}

export async function login(account: string, password: string): Promise<{ user: SessionUser; csrfToken: string }> {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ account, password }),
  });
  const body: AuthResponse = await resp.json();
  if (!body.ok || !body.data) throw new Error(body.error?.message || "登录失败");
  return body.data;
}

export async function getSession(): Promise<{ user: SessionUser; csrfToken: string } | null> {
  const resp = await fetch(`${API_BASE}/auth/session`, {
    credentials: "include",
  });
  const body: AuthResponse = await resp.json();
  if (!body.ok || !body.data) return null;
  return body.data;
}

export async function logout(csrfToken: string): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
    credentials: "include",
  });
}

export async function changePassword(currentPassword: string, newPassword: string, csrfToken: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const body: { ok: boolean; error?: { code: string; message: string } } = await resp.json();
  if (!body.ok) throw new Error(body.error?.message || "密码修改失败");
}
