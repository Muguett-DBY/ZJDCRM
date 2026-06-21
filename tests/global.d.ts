declare module "*.sql?raw" {
  const sql: string;

  export default sql;
}

declare module "cloudflare:test" {
  export const env: Cloudflare.Env;

  export type D1Migration = {
    name: string;
    queries: string[];
  };

  export function applyD1Migrations(
    db: D1Database,
    migrations: D1Migration[],
    migrationsTableName?: string,
  ): Promise<void>;
}
