const BASE = "/api";

interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; requestId: string };
}

class ApiError extends Error {
  code: string;
  requestId: string;
  constructor(code: string, message: string, requestId: string) {
    super(message);
    this.code = code;
    this.requestId = requestId;
  }
}

async function request<T>(
  method: string,
  path: string,
  options?: { body?: unknown; csrfToken?: string; params?: Record<string, string> },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options?.csrfToken) headers["X-CSRF-Token"] = options.csrfToken;

  let url = `${BASE}${path}`;
  if (options?.params) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(options.params)) {
      if (v) searchParams.set(k, v);
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const resp = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const envelope: ApiEnvelope<T> = await resp.json();

  if (!envelope.ok) {
    throw new ApiError(
      envelope.error?.code || "UNKNOWN",
      envelope.error?.message || "请求失败",
      envelope.error?.requestId || "",
    );
  }

  return envelope.data as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>) =>
    request<T>("GET", path, { params }),

  post: <T>(path: string, body?: unknown, csrfToken?: string) =>
    request<T>("POST", path, { body, csrfToken }),

  put: <T>(path: string, body?: unknown, csrfToken?: string) =>
    request<T>("PUT", path, { body, csrfToken }),

  delete: <T>(path: string, csrfToken?: string) =>
    request<T>("DELETE", path, { csrfToken }),
};
