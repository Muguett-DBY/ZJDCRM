# 行业字典管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make industry options editable in System Management and consume them in clue forms.

**Architecture:** Seed an `industry` dictionary, expose active dictionary items through an authenticated read endpoint, and add item update/soft-delete routes for the existing admin dictionary UI. The clue form loads active items from that endpoint and retains a legacy saved code during editing.

**Tech Stack:** Cloudflare D1, Hono, React, Vitest, Playwright.

---

### Task 1: Dictionary data and API

**Files:**
- Modify: `migrations/0005_seed.sql`, `server/modules/admin/admin.routes.ts`
- Test: `tests/integration/admin-workflows.test.ts`

- [ ] Write failing tests for active item retrieval and an administrator updating/deleting a dictionary item.
- [ ] Add the industry seed entries and secured public-read/admin mutation routes with audit events.
- [ ] Run `npm run test:run -- tests/integration/admin-workflows.test.ts`.

### Task 2: Dictionary editor and clue form

**Files:**
- Modify: `src/features/admin/DictionariesPage.tsx`, `src/features/clues/ClueFormPage.tsx`
- Test: `tests/e2e/app.spec.ts`

- [ ] Write a failing browser flow that adds an industry in Dictionary Management and observes it in New Clue.
- [ ] Add edit, status and delete controls; load active industry items in the clue form.
- [ ] Run the browser test and the full verification suite.
