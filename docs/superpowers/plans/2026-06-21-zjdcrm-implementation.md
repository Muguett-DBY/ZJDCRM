# ZJDCRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, publish, and deploy the PRD-complete V1.0 ZJDCRM application at `zjdcrm.custard.top`.

**Architecture:** A React and TypeScript single-page application is served by Cloudflare Pages. A Hono application running in Pages Functions exposes same-origin APIs, with D1 repositories for relational data, R2 for private attachments and exports, and a scheduled Worker for reminders and file expiry. Authentication, RBAC, data scope, audit logging, and business validation are shared service boundaries rather than controller-specific logic.

**Tech Stack:** React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, ECharts, Hono, Cloudflare Pages Functions, D1, R2, Vitest, Testing Library, Playwright, Wrangler.

---

## File Structure

```text
ZJDCRM/
├─ src/
│  ├─ app/                    # router, providers, layouts
│  ├─ components/             # reusable UI primitives and business widgets
│  ├─ features/
│  │  ├─ auth/
│  │  ├─ dashboard/
│  │  ├─ clues/
│  │  ├─ spaces/
│  │  ├─ reminders/
│  │  ├─ reports/
│  │  ├─ imports/
│  │  ├─ exports/
│  │  └─ admin/
│  ├─ lib/                    # API client, formatting, validation helpers
│  └─ styles/
├─ functions/
│  ├─ api/[[path]].ts         # Pages Functions entrypoint
│  └─ _middleware.ts          # response security headers
├─ server/
│  ├─ app.ts                  # Hono route composition
│  ├─ env.ts                  # generated binding types extension
│  ├─ middleware/             # auth, CSRF, request ID, errors, permissions
│  ├─ modules/                # controllers, services, repositories by feature
│  ├─ jobs/                   # reminders, exports, retention
│  └─ shared/                 # crypto, SQL, audit, validation
├─ migrations/                # ordered D1 schema and seed migrations
├─ worker/                    # scheduled Worker entrypoint
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ components/
│  └─ e2e/
├─ scripts/                   # seed, backup, migration and release checks
├─ public/
├─ wrangler.jsonc
├─ wrangler.cron.jsonc
└─ package.json
```

## Task 1: Scaffold the Cloudflare React Application

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles/global.css`
- Create: `functions/api/[[path]].ts`
- Create: `server/app.ts`
- Create: `wrangler.jsonc`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Add the failing smoke tests**

Create `tests/unit/app-smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { appName } from "../../src/app/meta";

describe("application metadata", () => {
  it("uses the configured product name", () => {
    expect(appName).toBe("ZJDCRM");
  });
});
```

Create `tests/integration/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApi } from "../../server/app";

describe("GET /api/health", () => {
  it("returns an operational response", async () => {
    const response = await createApi().request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "zjdcrm" });
  });
});
```

- [ ] **Step 2: Run tests and verify the scaffold is absent**

Run:

```powershell
npm test -- --run tests/unit/app-smoke.test.ts tests/integration/health.test.ts
```

Expected: FAIL because `src/app/meta.ts` and `server/app.ts` do not exist.

- [ ] **Step 3: Create the application scaffold**

Initialize dependencies:

```powershell
npm init -y
npm install react react-dom react-router-dom @tanstack/react-query react-hook-form @hookform/resolvers zod echarts echarts-for-react hono date-fns clsx lucide-react xlsx
npm install -D typescript vite @vitejs/plugin-react vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test wrangler @cloudflare/workers-types eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier
```

Create `src/app/meta.ts`:

```ts
export const appName = "ZJDCRM";
export const appDescription = "产业园区招商线索管理系统";
```

Create `server/app.ts`:

```ts
import { Hono } from "hono";

export function createApi() {
  const app = new Hono();
  app.get("/api/health", (c) => c.json({ ok: true, service: "zjdcrm" }));
  return app;
}
```

Create `functions/api/[[path]].ts`:

```ts
import { handle } from "hono/cloudflare-pages";
import { createApi } from "../../server/app";

export const onRequest = handle(createApi());
```

Create React entrypoints with `BrowserRouter`, `QueryClientProvider`, and a placeholder route that renders the product name. Configure Vite output as `dist`, Vitest for Node and jsdom projects, and package scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint .",
    "typecheck": "tsc -b --pretty false",
    "e2e": "playwright test",
    "cf:types": "wrangler types",
    "pages:dev": "wrangler pages dev dist",
    "deploy": "npm run build && wrangler pages deploy dist"
  }
}
```

Configure `wrangler.jsonc` with `compatibility_date: "2026-06-21"`, `nodejs_compat`, Pages output directory, D1 binding `DB`, R2 binding `FILES`, and observability enabled. Do not put secrets in this file.

- [ ] **Step 4: Verify scaffold**

Run:

```powershell
npm run cf:types
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all commands exit 0 and `dist/index.html` exists.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json tsconfig*.json vite.config.ts vitest.config.ts playwright.config.ts index.html src functions server wrangler.jsonc .env.example .gitignore
git commit -m "feat: scaffold Cloudflare CRM application"
```

## Task 2: Create the D1 Schema and Typed Database Utilities

**Files:**
- Create: `migrations/0001_core.sql`
- Create: `migrations/0002_business.sql`
- Create: `migrations/0003_workflows.sql`
- Create: `migrations/0004_indexes.sql`
- Create: `server/env.ts`
- Create: `server/shared/db.ts`
- Create: `server/shared/ids.ts`
- Create: `server/shared/time.ts`
- Create: `tests/integration/migrations.test.ts`
- Modify: `wrangler.jsonc`

- [ ] **Step 1: Write migration contract tests**

The test must apply every migration to an isolated SQLite-compatible D1 test database and assert the presence of:

```ts
const requiredTables = [
  "users", "departments", "roles", "permissions", "sessions",
  "companies", "clues", "contacts", "followups", "stage_histories",
  "parks", "buildings", "floors", "spaces", "clue_space_matches",
  "notifications", "import_jobs", "export_requests", "export_files",
  "audit_logs", "dictionaries", "dictionary_items", "system_settings"
];
```

Also assert indexes for normalized company name, clue owner/stage, contact phone, follow-up next time, notification recipient, and audit timestamp.

- [ ] **Step 2: Verify migrations fail**

Run:

```powershell
npm test -- --run tests/integration/migrations.test.ts
```

Expected: FAIL because migration files are missing.

- [ ] **Step 3: Implement the schema**

Use text UUID primary keys, ISO UTC timestamps, integer booleans, foreign keys, and `version INTEGER NOT NULL DEFAULT 1` on mutable business records. Add:

```sql
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  main_business TEXT NOT NULL,
  industry_code TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE UNIQUE INDEX companies_normalized_name_active_uq
ON companies(normalized_name) WHERE deleted_at IS NULL;
```

`clues` must include all PRD fields: title, company ID, desired area, acquired date, expected landing date, stage code, bottleneck, source code, internal referral flag, financing flag, prior location, lost reason, fiscal completion, expected output, expected tax, owner, department, tags through a relation table, actual landing fields, soft-delete fields, and version.

`audit_logs` must be append-only at the application layer and include actor, action, entity type, entity ID, IP, User-Agent, request ID, timestamp, and JSON summary.

- [ ] **Step 4: Verify schema**

Run:

```powershell
npm run test:run -- tests/integration/migrations.test.ts
npx wrangler d1 migrations apply zjdcrm-db --local
```

Expected: tests pass and all four migrations apply locally.

- [ ] **Step 5: Commit**

```powershell
git add migrations server/env.ts server/shared tests/integration/migrations.test.ts wrangler.jsonc
git commit -m "feat: add CRM database schema"
```

## Task 3: Implement Password Authentication, Sessions, and Account Lockout

**Files:**
- Create: `server/shared/crypto.ts`
- Create: `server/modules/auth/auth.schemas.ts`
- Create: `server/modules/auth/auth.repository.ts`
- Create: `server/modules/auth/auth.service.ts`
- Create: `server/modules/auth/auth.routes.ts`
- Create: `server/middleware/auth.ts`
- Create: `server/middleware/csrf.ts`
- Create: `server/middleware/errors.ts`
- Create: `server/middleware/request-id.ts`
- Create: `tests/unit/crypto.test.ts`
- Create: `tests/integration/auth.test.ts`
- Modify: `server/app.ts`

- [ ] **Step 1: Write failing authentication tests**

Cover:

```ts
it("hashes and verifies a password");
it("never returns the stored password hash");
it("sets an HttpOnly Secure SameSite cookie after login");
it("returns a generic error for unknown user and wrong password");
it("locks the account for 30 minutes after five failures");
it("rejects a mutation without a valid CSRF token");
it("invalidates the server-side session on logout");
```

- [ ] **Step 2: Verify red state**

Run:

```powershell
npm test -- --run tests/unit/crypto.test.ts tests/integration/auth.test.ts
```

Expected: FAIL because auth modules do not exist.

- [ ] **Step 3: Implement authentication**

Use Web Crypto:

```ts
export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 },
    key,
    256
  );
  return { salt: toBase64(salt), hash: toBase64(new Uint8Array(bits)), iterations: 310_000 };
}
```

Generate session and CSRF values with `crypto.getRandomValues`, store only SHA-256 hashes in D1, and compare derived hashes with a constant-time byte comparison. Authentication routes:

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
POST /api/auth/change-password
```

Record login success, failure, lockout, logout, and password changes.

- [ ] **Step 4: Verify auth**

Run:

```powershell
npm run test:run -- tests/unit/crypto.test.ts tests/integration/auth.test.ts
npm run typecheck
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add server tests/unit/crypto.test.ts tests/integration/auth.test.ts
git commit -m "feat: add secure account authentication"
```

## Task 4: Implement RBAC, Data Scope, and Audit Middleware

**Files:**
- Create: `server/modules/access/access.types.ts`
- Create: `server/modules/access/access.repository.ts`
- Create: `server/modules/access/access.service.ts`
- Create: `server/middleware/permission.ts`
- Create: `server/shared/audit.ts`
- Create: `tests/unit/access.test.ts`
- Create: `tests/integration/access.test.ts`

- [ ] **Step 1: Write permission tests**

Use the matrix:

```ts
const cases = [
  ["sales", "own clue", true],
  ["sales", "other clue", false],
  ["supervisor", "team clue", true],
  ["supervisor", "other team clue", false],
  ["management", "any clue", true],
  ["operations", "authorized department clue", true],
  ["disabled user", "own clue", false]
];
```

Test list, detail, attachment, mutation, report, and export paths, not only menu visibility.

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm test -- --run tests/unit/access.test.ts tests/integration/access.test.ts
```

- [ ] **Step 3: Implement shared access decisions**

Expose:

```ts
export type DataScope = "SELF" | "TEAM" | "ALL" | "DEPARTMENTS";

export interface AccessContext {
  userId: string;
  departmentId: string;
  roleCodes: string[];
  permissions: Set<string>;
  dataScopes: { type: DataScope; departmentIds: string[] }[];
}

export function requirePermission(code: string): MiddlewareHandler;
export function buildClueScopeSql(access: AccessContext, ownerAlias?: string): SqlFragment;
export async function assertClueAccess(db: D1Database, access: AccessContext, clueId: string, mode: "read" | "write" | "owner"): Promise<void>;
```

Every key mutation calls the record-level assertion. Every list and aggregate query consumes `buildClueScopeSql`. Audit writes use `ctx.waitUntil()` only for non-critical reads; security and mutation audit writes are awaited before success is returned.

- [ ] **Step 4: Verify permissions**

Run:

```powershell
npm run test:run -- tests/unit/access.test.ts tests/integration/access.test.ts
npm run lint
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/access server/middleware/permission.ts server/shared/audit.ts tests
git commit -m "feat: enforce CRM data permissions"
```

## Task 5: Build the Application Shell and Login Experience

**Files:**
- Create: `src/app/router.tsx`
- Create: `src/app/providers.tsx`
- Create: `src/app/AuthGuard.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/AdminShell.tsx`
- Create: `src/features/auth/LoginPage.tsx`
- Create: `src/features/auth/auth.api.ts`
- Create: `src/features/auth/auth.store.ts`
- Create: `src/components/ui/*`
- Create: `src/styles/tokens.css`
- Create: `tests/components/login.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Test successful validation, generic login errors, locked account messaging, keyboard navigation, loading state, session redirect, normal menu visibility, and `/admin` denial for a non-admin.

- [ ] **Step 2: Verify tests fail**

```powershell
npm test -- --run tests/components/login.test.tsx
```

- [ ] **Step 3: Implement the shell**

Build a desktop-first sidebar with permission-driven navigation, responsive content, accessible labels, visible focus states, and a compact 1366×768 layout. The main route set must match the design specification. `/admin` uses a visually distinct shell and requires `system:admin:access`.

Login submits:

```ts
const loginSchema = z.object({
  account: z.string().trim().min(1, "请输入账号"),
  password: z.string().min(1, "请输入密码")
});
```

Do not persist session tokens in localStorage.

- [ ] **Step 4: Verify UI**

```powershell
npm run test:run -- tests/components/login.test.tsx
npm run typecheck
npm run build
```

- [ ] **Step 5: Commit**

```powershell
git add src tests/components/login.test.tsx
git commit -m "feat: add authenticated CRM shell"
```

## Task 6: Implement Companies, Contacts, and Duplicate Detection

**Files:**
- Create: `server/modules/companies/*`
- Create: `server/modules/contacts/*`
- Create: `server/shared/normalize-company.ts`
- Create: `src/features/clues/CompanyFields.tsx`
- Create: `src/features/clues/ContactsPanel.tsx`
- Create: `tests/unit/normalize-company.test.ts`
- Create: `tests/integration/companies.test.ts`
- Create: `tests/components/contacts-panel.test.tsx`
- Modify: `server/app.ts`

- [ ] **Step 1: Write duplicate and contact tests**

Examples:

```ts
expect(normalizeCompanyName(" 上海　星辰科技有限公司 ")).toBe("上海星辰科技");
expect(normalizeCompanyName("上海星辰科技（有限责任公司）")).toBe("上海星辰科技");
```

Test duplicate company conflict, duplicate mobile conflict, primary decision maker, permission inheritance from clue, and soft-delete exclusion.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/unit/normalize-company.test.ts tests/integration/companies.test.ts tests/components/contacts-panel.test.tsx
```

- [ ] **Step 3: Implement companies and contacts**

Endpoints:

```text
GET  /api/companies/search
POST /api/companies/check-duplicate
GET  /api/clues/:clueId/contacts
POST /api/clues/:clueId/contacts
PUT  /api/clues/:clueId/contacts/:contactId
DELETE /api/clues/:clueId/contacts/:contactId
```

Return HTTP 409 with the existing entity ID on duplicate conflicts.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/unit/normalize-company.test.ts tests/integration/companies.test.ts tests/components/contacts-panel.test.tsx
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/companies server/modules/contacts server/shared/normalize-company.ts src/features/clues tests
git commit -m "feat: add companies and contacts"
```

## Task 7: Implement the招商线索 CRUD and Assignment Workflow

**Files:**
- Create: `server/modules/clues/*`
- Create: `src/features/clues/ClueListPage.tsx`
- Create: `src/features/clues/ClueFormPage.tsx`
- Create: `src/features/clues/ClueDetailPage.tsx`
- Create: `src/features/clues/UnassignedPage.tsx`
- Create: `src/features/clues/clues.api.ts`
- Create: `tests/integration/clues.test.ts`
- Create: `tests/components/clue-form.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `server/app.ts`

- [ ] **Step 1: Write clue lifecycle tests**

Cover all required fields, owner defaulting, no-owner import behavior, pagination, filters, optimistic version conflict, team assignment, owner transfer, soft deletion, restoration, and deletion denial for signed/landed clues.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/integration/clues.test.ts tests/components/clue-form.test.tsx
```

- [ ] **Step 3: Implement clue APIs and pages**

Endpoints:

```text
GET    /api/clues
POST   /api/clues
GET    /api/clues/:id
PUT    /api/clues/:id
DELETE /api/clues/:id
POST   /api/clues/:id/restore
POST   /api/clues/:id/assign
POST   /api/clues/:id/transfer
GET    /api/unassigned-clues
```

The list supports stage, source, industry, owner, tag, creation date, expected landing date, area range, stale-follow-up state, and keyword filters. The form matches every PRD core field.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/integration/clues.test.ts tests/components/clue-form.test.tsx
npm run typecheck
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/clues src/features/clues src/app/router.tsx tests
git commit -m "feat: add招商线索 management"
```

## Task 8: Implement Follow-ups, Timeline, Stage Transitions, and Reminders

**Files:**
- Create: `server/modules/followups/*`
- Create: `server/modules/stages/*`
- Create: `server/modules/notifications/*`
- Create: `src/features/clues/FollowUpComposer.tsx`
- Create: `src/features/clues/ClueTimeline.tsx`
- Create: `src/features/clues/StageChangeDialog.tsx`
- Create: `src/features/reminders/RemindersPage.tsx`
- Create: `tests/integration/stages.test.ts`
- Create: `tests/integration/followups.test.ts`
- Create: `tests/components/timeline.test.tsx`

- [ ] **Step 1: Write business-rule tests**

Cover:

```text
Initial contact requires at least one contact.
Lost or paused requires a reason.
Landed requires actual space, area, date, and fiscal completion.
Every transition requires a reason.
Stage change and history insertion are atomic.
Next follow-up creates a notification for the owner.
Important clue stage changes notify the supervisor.
```

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/integration/stages.test.ts tests/integration/followups.test.ts tests/components/timeline.test.tsx
```

- [ ] **Step 3: Implement timeline transactions**

Endpoints:

```text
GET  /api/clues/:id/timeline
POST /api/clues/:id/followups
POST /api/clues/:id/stage
GET  /api/notifications
POST /api/notifications/:id/read
POST /api/notifications/read-all
```

Follow-up creation may include `nextFollowUpAt`, `newStageCode`, and `stageReason`. If stage changes, service validation and timeline writes occur in one D1 batch.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/integration/stages.test.ts tests/integration/followups.test.ts tests/components/timeline.test.tsx
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/followups server/modules/stages server/modules/notifications src/features tests
git commit -m "feat: add follow-up timeline and stages"
```

## Task 9: Implement Space Resources and Multi-space Matching

**Files:**
- Create: `server/modules/spaces/*`
- Create: `src/features/spaces/SpaceListPage.tsx`
- Create: `src/features/spaces/SpaceDetailPage.tsx`
- Create: `src/features/spaces/SpaceForm.tsx`
- Create: `src/features/clues/SpaceMatchesPanel.tsx`
- Create: `tests/integration/spaces.test.ts`
- Create: `tests/components/space-match.test.tsx`

- [ ] **Step 1: Write space tests**

Test park/building/floor hierarchy, available-area filtering, operations-only status changes, multiple clue matches to one space, multiple candidate spaces per clue, delete denial for referenced spaces, and landed-space capture.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/integration/spaces.test.ts tests/components/space-match.test.tsx
```

- [ ] **Step 3: Implement space management**

Endpoints:

```text
GET/POST/PUT/DELETE /api/parks
GET/POST/PUT/DELETE /api/buildings
GET/POST/PUT/DELETE /api/floors
GET/POST/PUT/DELETE /api/spaces
GET  /api/clues/:id/space-matches
POST /api/clues/:id/space-matches
DELETE /api/clues/:id/space-matches/:matchId
```

Display hierarchy labels, total area, available area, status, expected release date, and notes.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/integration/spaces.test.ts tests/components/space-match.test.tsx
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/spaces src/features/spaces src/features/clues/SpaceMatchesPanel.tsx tests
git commit -m "feat: add park space matching"
```

## Task 10: Implement Private R2 Attachments

**Files:**
- Create: `server/modules/files/*`
- Create: `src/components/files/AttachmentUploader.tsx`
- Create: `src/components/files/AttachmentList.tsx`
- Create: `tests/integration/files.test.ts`
- Modify: `server/app.ts`

- [ ] **Step 1: Write file security tests**

Test allowed types, size limits, randomized keys, unauthorized download denial, clue-level permission inheritance, metadata persistence, and delayed deletion.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/integration/files.test.ts
```

- [ ] **Step 3: Implement R2 file routes**

```text
POST   /api/files
GET    /api/files/:id
DELETE /api/files/:id
```

Accept PDF, Office documents, images, and text files. Reject executable or mismatched MIME/extension pairs. Stream R2 responses and never load unbounded files into memory.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/integration/files.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/files src/components/files tests/integration/files.test.ts
git commit -m "feat: add private CRM attachments"
```

## Task 11: Implement Dashboard and Reports

**Files:**
- Create: `server/modules/reports/*`
- Create: `src/features/dashboard/DashboardPage.tsx`
- Create: `src/features/dashboard/widgets/*`
- Create: `src/features/reports/ReportsPage.tsx`
- Create: `src/features/reports/charts/*`
- Create: `tests/unit/report-math.test.ts`
- Create: `tests/integration/reports.test.ts`
- Create: `tests/components/dashboard.test.tsx`

- [ ] **Step 1: Write metric tests**

Test date filtering, scoped aggregation, stage distribution, zero-denominator conversion rate, channel conversion, owner performance, average follow-ups, stale clues, expected area, expected output/tax, fiscal completion, and space status totals.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/unit/report-math.test.ts tests/integration/reports.test.ts tests/components/dashboard.test.tsx
```

- [ ] **Step 3: Implement reports**

Endpoints:

```text
GET /api/dashboard/summary
GET /api/reports/funnel
GET /api/reports/channels
GET /api/reports/performance
GET /api/reports/followup-efficiency
GET /api/reports/spaces
GET /api/reports/landings
```

Every endpoint receives the shared access scope. ECharts clicks navigate to `/clues` with equivalent filters.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/unit/report-math.test.ts tests/integration/reports.test.ts tests/components/dashboard.test.tsx
npm run build
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/reports src/features/dashboard src/features/reports tests
git commit -m "feat: add招商 analytics dashboard"
```

## Task 12: Implement Fixed-template Excel Imports

**Files:**
- Create: `server/modules/imports/*`
- Create: `src/features/imports/ImportPage.tsx`
- Create: `src/features/imports/ImportResultTable.tsx`
- Create: `scripts/generate-import-templates.ts`
- Create: `public/templates/*.xlsx`
- Create: `tests/unit/import-validation.test.ts`
- Create: `tests/integration/imports.test.ts`

- [ ] **Step 1: Write import tests**

Test template version, required headers, invalid dates/numbers, missing required fields, unknown dictionary values, duplicate company/mobile, no-owner routing to unassigned, partial failure reporting, and 1000-row batching.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/unit/import-validation.test.ts tests/integration/imports.test.ts
```

- [ ] **Step 3: Implement import jobs**

Endpoints:

```text
POST /api/imports
GET  /api/imports/:id
POST /api/imports/:id/process
GET  /api/imports/:id/failures
```

Generate templates with a hidden metadata sheet containing `templateType` and `version`. Parse workbooks in bounded batches and persist row outcomes. Use an idempotency key so retrying a processing chunk does not duplicate rows.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/unit/import-validation.test.ts tests/integration/imports.test.ts
npm run build
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/imports src/features/imports scripts public/templates tests
git commit -m "feat: add fixed-template imports"
```

## Task 13: Implement Export Approval and Expiring Downloads

**Files:**
- Create: `server/modules/exports/*`
- Create: `src/features/exports/ExportRequestsPage.tsx`
- Create: `src/features/exports/ExportApplicationDialog.tsx`
- Create: `src/features/admin/ExportApprovalPage.tsx`
- Create: `tests/unit/export-token.test.ts`
- Create: `tests/integration/exports.test.ts`

- [ ] **Step 1: Write export workflow tests**

Cover reason required, ordinary salesperson denied, approval and rejection, rejection reason required, scope snapshot, current-scope revalidation, private R2 storage, 24-hour expiry, one user unable to use another user's link, download logging, and expired object cleanup eligibility.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/unit/export-token.test.ts tests/integration/exports.test.ts
```

- [ ] **Step 3: Implement export workflow**

Endpoints:

```text
POST /api/export-requests
GET  /api/export-requests
POST /api/export-requests/:id/approve
POST /api/export-requests/:id/reject
POST /api/export-requests/:id/generate
GET  /api/export-files/:token
```

Generate a cryptographically random token, save only its SHA-256 hash, and set `expires_at` to approval generation time plus 24 hours.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/unit/export-token.test.ts tests/integration/exports.test.ts
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/exports src/features/exports src/features/admin/ExportApprovalPage.tsx tests
git commit -m "feat: add controlled CRM exports"
```

## Task 14: Build the Full `/admin` Management Console

**Files:**
- Create: `server/modules/admin/*`
- Create: `src/features/admin/AdminDashboardPage.tsx`
- Create: `src/features/admin/UsersPage.tsx`
- Create: `src/features/admin/DepartmentsPage.tsx`
- Create: `src/features/admin/RolesPage.tsx`
- Create: `src/features/admin/DictionariesPage.tsx`
- Create: `src/features/admin/AuditLogPage.tsx`
- Create: `src/features/admin/SystemSettingsPage.tsx`
- Create: `src/features/admin/DeletedRecordsPage.tsx`
- Create: `tests/integration/admin.test.ts`
- Create: `tests/components/admin.test.tsx`

- [ ] **Step 1: Write admin tests**

Test account creation/disable, role assignment, department tree, data scopes, permission changes, dictionary safeguards, branding settings, audit filtering, restore operations, and complete denial for a non-admin.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/integration/admin.test.ts tests/components/admin.test.tsx
```

- [ ] **Step 3: Implement admin console**

The admin routes must cover:

```text
/api/admin/users
/api/admin/departments
/api/admin/roles
/api/admin/permissions
/api/admin/dictionaries
/api/admin/audit-logs
/api/admin/login-logs
/api/admin/settings
/api/admin/deleted-records
```

Reject removal of the final active super administrator. Prevent deletion of dictionary items already referenced by business records; allow disabling them.

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/integration/admin.test.ts tests/components/admin.test.tsx
npm run typecheck
```

- [ ] **Step 5: Commit**

```powershell
git add server/modules/admin src/features/admin tests
git commit -m "feat: add hidden admin console"
```

## Task 15: Add Scheduled Jobs, Seed Data, Backup Scripts, and Security Headers

**Files:**
- Create: `worker/index.ts`
- Create: `server/jobs/reminders.ts`
- Create: `server/jobs/export-retention.ts`
- Create: `server/jobs/file-retention.ts`
- Create: `scripts/seed-production.ts`
- Create: `scripts/backup-d1.ps1`
- Create: `scripts/backup-r2.ps1`
- Create: `functions/_middleware.ts`
- Create: `wrangler.cron.jsonc`
- Create: `tests/integration/jobs.test.ts`
- Create: `tests/integration/security-headers.test.ts`

- [ ] **Step 1: Write job and header tests**

Test due reminder creation without duplicates, expired export invalidation, delayed file deletion, initial role/dictionary seed, admin bootstrap from secret, and CSP/HSTS/content-type/referrer/permissions headers.

- [ ] **Step 2: Verify failures**

```powershell
npm test -- --run tests/integration/jobs.test.ts tests/integration/security-headers.test.ts
```

- [ ] **Step 3: Implement operations support**

The scheduled Worker runs every 15 minutes for reminders and nightly for retention. `seed-production.ts` reads `INITIAL_ADMIN_PASSWORD` from runtime secret, hashes it, creates `admin`, and never logs the value.

Security middleware sets:

```text
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- [ ] **Step 4: Verify**

```powershell
npm run test:run -- tests/integration/jobs.test.ts tests/integration/security-headers.test.ts
npm run lint
```

- [ ] **Step 5: Commit**

```powershell
git add worker server/jobs scripts functions/_middleware.ts wrangler.cron.jsonc tests
git commit -m "feat: add CRM operations automation"
```

## Task 16: Complete End-to-end Tests and Performance Checks

**Files:**
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/clue-lifecycle.spec.ts`
- Create: `tests/e2e/supervisor.spec.ts`
- Create: `tests/e2e/export.spec.ts`
- Create: `tests/e2e/admin.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `scripts/performance-budget.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the full PRD acceptance journeys**

Automate:

```text
Admin creates department, supervisor, salesperson, management and operations accounts.
Salesperson creates a clue, adds a contact, follow-up, next reminder, stage change and candidate spaces.
Supervisor sees team data and reassigns an unassigned clue.
Unauthorized user cannot read or edit another team's clue.
Operations imports clues and spaces and reviews failure rows.
Applicant requests an export; management approves it; applicant downloads it; expired URL fails.
Admin changes dictionaries and branding and reviews audit logs.
Landed stage rejects missing required fields and accepts complete landing data.
```

- [ ] **Step 2: Run end-to-end tests and capture failures**

```powershell
npm run build
npx wrangler pages dev dist --local --port 8788
npm run e2e
```

Expected before fixes: at least one acceptance test exposes missing UI or API wiring.

- [ ] **Step 3: Close acceptance gaps**

Fix only failures required by the PRD journeys. Add `scripts/performance-budget.mjs` to reject:

```text
Initial JavaScript over 450 KiB gzip.
Any lazy route chunk over 350 KiB gzip.
Global CSS over 120 KiB gzip.
```

Add package script:

```json
"verify": "npm run lint && npm run typecheck && npm run test:coverage && npm run build && node scripts/performance-budget.mjs && npm run e2e"
```

- [ ] **Step 4: Run the full verification ladder**

```powershell
npm run verify
```

Expected: lint, typecheck, unit/integration/component coverage, build, budgets, and Playwright all pass.

- [ ] **Step 5: Commit**

```powershell
git add tests/e2e scripts/performance-budget.mjs package.json package-lock.json src server
git commit -m "test: verify complete CRM workflows"
```

## Task 17: Publish the Public GitHub Repository

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add repository documentation**

README must contain product scope, architecture, local prerequisites, setup, local D1 migration, local seed, test commands, Cloudflare bindings, deployment, backup, and the rule that production secrets never belong in Git.

Use the MIT license and document private vulnerability reporting without publishing credentials.

- [ ] **Step 2: Add CI**

GitHub Actions runs on pull requests and pushes:

```yaml
- npm ci
- npm run lint
- npm run typecheck
- npm run test:coverage
- npm run build
- node scripts/performance-budget.mjs
```

Browser tests run separately with Playwright browsers installed.

- [ ] **Step 3: Verify repository safety**

Run:

```powershell
rg -n "INITIAL_ADMIN_PASSWORD=|CLOUDFLARE_API_TOKEN=|gho_|Bearer " .
git status --short
npm run verify
```

Expected: no secret matches, only intended files are changed, and verification passes.

- [ ] **Step 4: Create and push the repository**

```powershell
gh repo create Muguett-DBY/ZJDCRM --public --source . --remote origin --description "产业园区招商线索管理系统"
git add README.md LICENSE SECURITY.md CONTRIBUTING.md .github
git commit -m "docs: prepare public repository"
git push -u origin main
```

Expected: public repository exists at `https://github.com/Muguett-DBY/ZJDCRM`.

## Task 18: Provision Cloudflare, Deploy, Bind Domain, and Verify Production

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `wrangler.cron.jsonc`
- Create: `docs/operations/deployment.md`
- Create: `docs/operations/recovery.md`

- [ ] **Step 1: Provision production resources**

Create:

```powershell
npx wrangler d1 create zjdcrm-db
npx wrangler r2 bucket create zjdcrm-files
npx wrangler pages project create zjdcrm --production-branch main
```

Write generated resource IDs into non-secret binding config. Set the user-provided initial password interactively so it is never echoed into repository files or shell history:

```powershell
npx wrangler pages secret put INITIAL_ADMIN_PASSWORD --project-name zjdcrm
```

- [ ] **Step 2: Apply migrations and seed**

```powershell
npx wrangler d1 migrations apply zjdcrm-db --remote
npx wrangler pages secret put SESSION_PEPPER --project-name zjdcrm
npm run seed:production
```

Generate `SESSION_PEPPER` with a cryptographically secure local command and provide it through stdin; do not print or save it.

- [ ] **Step 3: Deploy and connect GitHub**

```powershell
npm run build
npx wrangler pages deploy dist --project-name zjdcrm --branch main --commit-dirty=true
```

Configure the Pages project to use the GitHub repository and main branch for future continuous deployment. Deploy the scheduled Worker and its D1/R2 bindings.

- [ ] **Step 4: Bind `zjdcrm.custard.top`**

Add the custom domain to the Pages project through Cloudflare Pages domain management. Confirm DNS is proxied and the certificate is active.

- [ ] **Step 5: Run production verification**

Run remote Playwright against `https://zjdcrm.custard.top` and verify:

```text
HTTPS and security headers.
Admin login with initial credentials.
Forced or successful password change.
Account creation and role visibility.
Clue, contact, follow-up, stage and space flows.
Import result reporting.
Export approval and protected download.
Audit log entries.
1366×768 and narrow viewport layout.
Unauthorized API denial.
```

Then run:

```powershell
npx wrangler pages deployment list --project-name zjdcrm
npx wrangler d1 execute zjdcrm-db --remote --command "SELECT COUNT(*) AS users FROM users;"
```

Expected: production deployment is active and the database contains the initialized administrator.

- [ ] **Step 6: Commit deployment documentation**

```powershell
git add wrangler.jsonc wrangler.cron.jsonc docs/operations
git commit -m "docs: record production operations"
git push
```

## Final Verification Checklist

- [ ] `npm run verify` passes locally.
- [ ] GitHub Actions passes on `main`.
- [ ] Public repository contains no credentials or production data.
- [ ] D1 migrations and default dictionaries are applied remotely.
- [ ] R2 attachments and exports are private.
- [ ] `admin` exists and the initial password is not stored in Git.
- [ ] `https://zjdcrm.custard.top` resolves with a valid certificate.
- [ ] `/admin` rejects ordinary users.
- [ ] All PRD chapter 16 acceptance items have automated or documented production evidence.
- [ ] Backup and recovery commands are documented and tested on a non-production export.
