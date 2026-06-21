import { describe, expect, it } from "vitest";
import { appName } from "../../src/app/meta";

describe("application metadata", () => {
  it("uses the configured product name", () => {
    expect(appName).toBe("ZJDCRM");
  });
});
