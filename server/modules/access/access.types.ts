export type DataScopeType = "self" | "team" | "all" | "department" | "custom";

export interface DataScope {
  type: DataScopeType;
  departmentIds: string[];
}

export interface AccessContext {
  userId: string;
  departmentId: string | null;
  roleCodes: string[];
  permissions: Set<string>;
  dataScopes: DataScope[];
}

export interface ClueAccessFilter {
  sql: string;
  params: unknown[];
}
