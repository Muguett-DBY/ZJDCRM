import { describe, expect, it } from "vitest";
import { createApi } from "../../server/app";

describe("GET /api/health", () => {
  it("returns an operational response", async () => {
    const response = await createApi().request("/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "zjdcrm" });
  });
});
