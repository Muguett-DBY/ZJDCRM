import { describe, expect, it } from "vitest";
import { buildClueScopeFilter, hasPermission } from "../../server/modules/access/access.service";
import type { AccessContext, DataScope } from "../../server/modules/access/access.types";

function makeAccess(opts: {
  userId?: string;
  departmentId?: string | null;
  roleCodes?: string[];
  permissions?: string[];
  dataScopes?: DataScope[];
}): AccessContext {
  return {
    userId: opts.userId || "user-1",
    departmentId: opts.departmentId ?? "dept-1",
    roleCodes: opts.roleCodes || [],
    permissions: new Set(opts.permissions || []),
    dataScopes: opts.dataScopes || [],
  };
}

describe("data scope filter", () => {
  it("returns empty SQL for wildcard permission (super admin)", () => {
    const access = makeAccess({ permissions: ["*"] });
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toBe("");
    expect(filter.params).toHaveLength(0);
  });

  it("returns empty SQL for ALL data scope", () => {
    const access = makeAccess({
      permissions: ["clue:read"],
      dataScopes: [{ type: "all", departmentIds: [] }],
    });
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toBe("");
  });

  it("generates SELF scope filter", () => {
    const access = makeAccess({
      userId: "user-1",
      dataScopes: [{ type: "self", departmentIds: [] }],
    });
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toContain("c.owner_id = ?");
    expect(filter.params).toContain("user-1");
  });

  it("generates TEAM scope filter", () => {
    const access = makeAccess({
      departmentId: "dept-1",
      dataScopes: [{ type: "team", departmentIds: [] }],
    });
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toContain("c.department_id = ?");
    expect(filter.params).toContain("dept-1");
  });

  it("generates DEPARTMENT scope filter", () => {
    const access = makeAccess({
      dataScopes: [{ type: "department", departmentIds: ["dept-1", "dept-2"] }],
    });
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toContain("c.department_id = ?");
    expect(filter.params).toContain("dept-1");
    expect(filter.params).toContain("dept-2");
  });

  it("returns impossible condition when no scopes granted", () => {
    const access = makeAccess({ dataScopes: [] });
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toBe("1 = 0");
  });

  it("supports custom owner alias", () => {
    const access = makeAccess({
      userId: "user-1",
      dataScopes: [{ type: "self", departmentIds: [] }],
    });
    const filter = buildClueScopeFilter(access, "clue.owner_id");
    expect(filter.sql).toContain("clue.owner_id = ?");
  });
});

describe("permission checks", () => {
  it("wildcard permission grants everything", () => {
    const access = makeAccess({ permissions: ["*"] });
    expect(hasPermission(access, "clue:read")).toBe(true);
    expect(hasPermission(access, "clue:delete")).toBe(true);
    expect(hasPermission(access, "data:export")).toBe(true);
  });

  it("specific permission is required", () => {
    const access = makeAccess({ permissions: ["clue:read", "clue:create"] });
    expect(hasPermission(access, "clue:read")).toBe(true);
    expect(hasPermission(access, "clue:create")).toBe(true);
    expect(hasPermission(access, "clue:delete")).toBe(false);
    expect(hasPermission(access, "data:export")).toBe(false);
  });

  it("empty permissions grant nothing", () => {
    const access = makeAccess({ permissions: [] });
    expect(hasPermission(access, "clue:read")).toBe(false);
  });
});

describe("different role access patterns", () => {
  it("super admin accesses everything", () => {
    const access = makeAccess({ permissions: ["*"] });
    expect(hasPermission(access, "clue:read")).toBe(true);
    expect(hasPermission(access, "clue:create")).toBe(true);
    expect(hasPermission(access, "data:export")).toBe(true);

    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toBe(""); // no filter
  });

  it("management accesses everything with specific permissions", () => {
    const access = makeAccess({
      permissions: ["clue:read", "clue:create", "data:export", "export:approve"],
      dataScopes: [{ type: "all", departmentIds: [] }],
    });
    expect(hasPermission(access, "data:export")).toBe(true);
    expect(hasPermission(access, "export:approve")).toBe(true);
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toBe(""); // ALL scope
  });

  it("supervisor accesses team data with specific permissions", () => {
    const access = makeAccess({
      departmentId: "dept-1",
      permissions: ["clue:read", "clue:create", "clue:assign"],
      dataScopes: [{ type: "team", departmentIds: [] }],
    });
    expect(hasPermission(access, "clue:assign")).toBe(true);
    expect(hasPermission(access, "data:export")).toBe(false);
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toContain("c.department_id = ?");
    expect(filter.params).toContain("dept-1");
  });

  it("salesperson only accesses own records", () => {
    const access = makeAccess({
      userId: "sales-1",
      permissions: ["clue:read", "clue:create", "clue:edit"],
      dataScopes: [{ type: "self", departmentIds: [] }],
    });
    expect(hasPermission(access, "clue:edit")).toBe(true);
    expect(hasPermission(access, "clue:delete")).toBe(false);
    expect(hasPermission(access, "data:export")).toBe(false);
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toContain("c.owner_id = ?");
    expect(filter.params).toContain("sales-1");
  });

  it("operations accesses authorized departments", () => {
    const access = makeAccess({
      permissions: ["clue:read", "clue:create", "clue:edit", "data:import", "data:export"],
      dataScopes: [{ type: "department", departmentIds: ["dept-1", "dept-3"] }],
    });
    expect(hasPermission(access, "data:import")).toBe(true);
    expect(hasPermission(access, "data:export")).toBe(true);
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toContain("c.department_id = ?");
    // Should have params for both departments
    expect(filter.params.filter((p) => p === "dept-1" || p === "dept-3")).toHaveLength(2);
  });

  it("disabled user has no permissions", () => {
    const access = makeAccess({ permissions: [], dataScopes: [] });
    expect(hasPermission(access, "clue:read")).toBe(false);
    const filter = buildClueScopeFilter(access);
    expect(filter.sql).toBe("1 = 0");
  });
});
