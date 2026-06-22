# Lead Reserve Tags and Clue Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reserve status tags during XLSX import and make招商线索 a board plus filterable complete data table.

**Architecture:** Keep import normalization in `shared/xlsx-import-preview.ts`, extend `/api/clues` to return row tags and board statistics, then update `src/features/clues/ClueListPage.tsx` to expose filters and cards. Use existing `tags` and `clue_tags` tables; no schema migration is needed.

**Tech Stack:** TypeScript, Hono, D1 SQL, React, Vitest, Playwright.

---

### Task 1: Import status tags

**Files:**
- Modify: `shared/xlsx-import-preview.ts`
- Test: `tests/unit/xlsx-import.test.ts`

- [ ] Add failing tests for reserve rows classified as `近两周新增`, `重点在签约`, `无跟进价值`, and `已签约`.
- [ ] Implement deterministic tag inference using acquired date and row text.
- [ ] Run `npm run test:run -- tests/unit/xlsx-import.test.ts`.

### Task 2: Clue list API board and filters

**Files:**
- Modify: `server/modules/clues/clues.routes.ts`
- Test: `tests/integration/admin-workflows.test.ts`

- [ ] Add failing tests for filtering by tag/industry/owner/date/area and receiving board statistics.
- [ ] Extend SQL conditions using safe bound parameters and existing access-scope filtering.
- [ ] Return `summary` and each row's `tag_names`/`tag_list`.
- [ ] Run `npm run test:run -- tests/integration/admin-workflows.test.ts -t "filters clues"`.

### Task 3: Frontend board and complete table

**Files:**
- Modify: `src/features/clues/ClueListPage.tsx`
- Test: `tests/e2e/app.spec.ts`

- [ ] Add filters and dashboard cards above the table.
- [ ] Add table columns for tags, industry, owner, acquired date, expected landing date, area, bottleneck, prior location, financing, and updated date.
- [ ] Add e2e coverage for opening the clue list and seeing board/filter UI.
- [ ] Run `npm run e2e`.

### Task 4: Full verification and release

- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.
- [ ] Run `npm run e2e`.
- [ ] Run `npm audit --audit-level=high`.
- [ ] Commit and push `main`.
- [ ] Confirm Cloudflare Pages production deployment is active.
