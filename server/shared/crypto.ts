/** Base64-encode a Uint8Array without padding */
function toBase64(bytes: Uint8Array): string {
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binStr);
}

/** Base64-decode a string back to a Uint8Array */
function fromBase64(str: string): Uint8Array {
  const binStr = atob(str);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

/** Constant-time comparison of two Uint8Arrays */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** Hash a password using PBKDF2-SHA-256 */
export async function hashPassword(
  password: string,
  salt = crypto.getRandomValues(new Uint8Array(16)),
  iterations = 310_000,
): Promise<{ hash: string; salt: string; iterations: number }> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as unknown as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  );

  return {
    hash: toBase64(new Uint8Array(bits)),
    salt: toBase64(salt),
    iterations,
  };
}

/** Verify a password against a stored hash/salt/iterations */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  const saltBytes = fromBase64(salt);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as unknown as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes as unknown as BufferSource, iterations },
    key,
    256,
  );

  const computedHash = toBase64(new Uint8Array(bits));
  const aBytes = fromBase64(computedHash);
  const bBytes = fromBase64(storedHash);
  return constantTimeEqual(aBytes, bBytes);
}

/** Generate a cryptographically secure random token for session / CSRF */
export function createSecureToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toBase64(bytes);
}

/** Hash a session/CSRF token for storage (SHA-256 hex) — async because Cloudflare Workers use async subtle */
export async function hashSessionToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  const arr = new Uint8Array(hash);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
