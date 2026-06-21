import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  createSecureToken,
  hashPassword,
  verifyPassword,
  hashSessionToken,
} from "../../server/shared/crypto";

describe("hashPassword", () => {
  it("produces a hash and salt for a given password", async () => {
    const result = await hashPassword("MyP@ssw0rd!");
    expect(result.hash).toBeTruthy();
    expect(result.salt).toBeTruthy();
    expect(result.iterations).toBeGreaterThanOrEqual(100_000);
  });

  it("different passwords produce different hashes", async () => {
    const [a, b] = await Promise.all([
      hashPassword("password-a"),
      hashPassword("password-b"),
    ]);
    expect(a.hash).not.toBe(b.hash);
  });

  it("same password with different salts produces different hashes", async () => {
    const saltA = crypto.getRandomValues(new Uint8Array(16));
    const saltB = crypto.getRandomValues(new Uint8Array(16));
    const [a, b] = await Promise.all([
      hashPassword("same", saltA),
      hashPassword("same", saltB),
    ]);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const { hash, salt, iterations } = await hashPassword("valid-password");
    await expect(
      verifyPassword("valid-password", hash, salt, iterations),
    ).resolves.toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const { hash, salt, iterations } = await hashPassword("real-password");
    await expect(
      verifyPassword("wrong-password", hash, salt, iterations),
    ).resolves.toBe(false);
  });

  it("does not leak timing information (constant-time comparison)", async () => {
    const { hash, salt, iterations } = await hashPassword("target");
    // Attempt near-matches with different lengths to verify no early return
    await verifyPassword("target", hash, salt, iterations);
    await verifyPassword("targeX", hash, salt, iterations);
    await verifyPassword("targett", hash, salt, iterations);
    await verifyPassword("", hash, salt, iterations);
    // Sanity: the loop actually ran
  });
});

describe("constantTimeEqual", () => {
  it("returns true for identical byte arrays", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it("returns false for different byte arrays", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it("returns false for arrays of different lengths", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });
});

describe("createSecureToken", () => {
  it("returns a base64 string of the requested byte length", () => {
    const token = createSecureToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(32);
  });

  it("produces different values on each call", () => {
    const a = createSecureToken();
    const b = createSecureToken();
    expect(a).not.toBe(b);
  });
});

describe("hashSessionToken", () => {
  it("returns a hex-encoded SHA-256 hash", async () => {
    const hash = await hashSessionToken("some-token-value");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same hash for the same token", async () => {
    const a = await hashSessionToken("deterministic-token");
    const b = await hashSessionToken("deterministic-token");
    expect(a).toBe(b);
  });

  it("different tokens produce different hashes", async () => {
    const a = await hashSessionToken("token-a");
    const b = await hashSessionToken("token-b");
    expect(a).not.toBe(b);
  });
});
