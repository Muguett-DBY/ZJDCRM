# UI Copy Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the admin to change all registered fixed UI copy without changing data contracts.

**Architecture:** A shared frontend catalog supplies defaults and a `CopyProvider` merges public overrides. Admin routes persist only validated overrides in `system_settings`; the new admin page edits these entries by group.

**Tech Stack:** React, Hono, D1, Vitest, Playwright.

---

### Task 1: Catalog and secured content API

**Files:**
- Create: `src/lib/ui-copy.ts`, `server/modules/content/content.routes.ts`
- Modify: `server/app.ts`, `tests/integration/admin-workflows.test.ts`

- [ ] Add failing tests for admin save/read/reset, public read and invalid-key rejection.
- [ ] Implement catalog validation, JSON persistence, audit logging and public/admin endpoints.
- [ ] Run integration tests.

### Task 2: Shared frontend provider and all registered pages

**Files:**
- Create: `src/lib/copy-provider.tsx`
- Modify: `src/main.tsx`, application shells and all feature pages containing registered fixed copy.
- Test: `tests/components/copy-provider.test.tsx`, `tests/e2e/app.spec.ts`

- [ ] Add a failing component test proving an override replaces a default.
- [ ] Implement provider and convert all registered labels, titles, buttons and placeholders to stable copy keys.
- [ ] Run component and browser tests.

### Task 3: Admin copy editor and release verification

**Files:**
- Create: `src/features/admin/CopyManagementPage.tsx`
- Modify: `src/app/AdminShell.tsx`, `src/app/router.tsx`, `tests/e2e/app.spec.ts`

- [ ] Add a failing browser flow that changes “线索名称” and observes the updated label in multiple clue pages.
- [ ] Implement grouped search, edit, save and reset controls.
- [ ] Run full tests, build, browser tests, production smoke, then push `main`.
