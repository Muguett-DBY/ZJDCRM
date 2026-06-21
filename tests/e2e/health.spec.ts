import { expect, test } from "@playwright/test";

test("serves the health endpoint through Cloudflare Pages", async ({
  request,
}) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toEqual({ ok: true, service: "zjdcrm" });
});
