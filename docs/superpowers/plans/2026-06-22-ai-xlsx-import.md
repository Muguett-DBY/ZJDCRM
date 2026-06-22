# AI XLSX Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-assisted XLSX import for the user's multi-sheet招商台账 and import leads, tags, follow-ups, spaces, and space matches after preview confirmation.

**Architecture:** The browser parses `.xlsx` into workbook JSON with `read-excel-file`, then calls a protected backend preview endpoint. The backend calls OpenCode Go `mimo-v2.5` for ambiguous cleanup, applies deterministic validation/mapping, and the existing import endpoint is extended to persist richer rows.

**Tech Stack:** React, TypeScript, Vite, Hono Pages Functions, Cloudflare D1/R2, `read-excel-file`, Vitest, Playwright, OpenCode Go chat completions API.

---

## Files

- Create `src/lib/xlsx-import.ts`: browser-side sheet reader and workbook normalization.
- Create `src/lib/import-normalization.ts`: deterministic mapping helpers shared by tests and UI.
- Modify `src/features/imports/ImportPage.tsx`: add XLSX mode, preview UI, confirm import.
- Modify `server/modules/workflows/workflows.routes.ts`: add `/api/imports/ai-preview` and enhance `/api/imports`.
- Modify `worker-configuration.d.ts` or regenerate types if env bindings change.
- Modify `.env.example`: document `OPENCODE_GO_API_KEY`.
- Add tests in `tests/unit/xlsx-import.test.ts`, `tests/unit/import-normalization.test.ts`, and `tests/integration/admin-workflows.test.ts`.
- Update e2e `tests/e2e/app.spec.ts` with the preview/import flow if practical with a generated workbook fixture.

## Tasks

### Task 1: Deterministic normalization helpers

- [ ] Add failing tests for:
  - `mapIndustry("芯片加工") === "integrated_circuit"`.
  - `mapSource("基金") === "activity"`.
  - `mapStage("已多次考察") === "site_visit"`.
  - Excel serial date `46170` converts to an ISO date.
- [ ] Implement `src/lib/import-normalization.ts`.
- [ ] Run `npm run test:run -- tests/unit/import-normalization.test.ts`.

### Task 2: XLSX workbook extraction

- [ ] Add `read-excel-file` dependency.
- [ ] Add `src/lib/xlsx-import.ts` with:
  - `readWorkbook(file): Promise<WorkbookSheet[]>`.
  - `detectSheetKind(sheetName): "lead-reserve" | "shortlist" | "space-control" | "event-leads" | "reference"`.
  - header row detection for the user's workbook.
- [ ] Add unit tests using in-memory rows for header detection and sheet-kind detection.

### Task 3: AI preview endpoint

- [ ] Add `/api/imports/ai-preview` requiring auth, CSRF, and `data:import`.
- [ ] Read `OPENCODE_GO_API_KEY` from env.
- [ ] Call `https://opencode.ai/zen/go/v1/chat/completions` with:
  - `model: "mimo-v2.5"`
  - `reasoning_effort: "high"`
  - `max_tokens >= 8000`
  - JSON-only prompt.
- [ ] Parse the response content and apply deterministic repair:
  - title cannot exceed 80 chars unless companyName is also long.
  - missing industry/source/stage uses deterministic mapper.
  - short督办 rows merge by normalized companyName.
- [ ] Return preview payload:
  - `leadRows`
  - `spaceRows`
  - `warnings`
  - `stats`
- [ ] Test with mocked `fetch`.

### Task 4: Enhanced import persistence

- [ ] Extend `/api/imports` to accept `normalizedRows` with lead tags and follow-up content.
- [ ] Ensure tags exist: `重点客户`, `短期督办`, `会招`, `客户储备`.
- [ ] Create or reuse companies by normalized name.
- [ ] Create clues, followups, clue_tags, spaces, and clue_space_matches.
- [ ] Preserve row-level failures in `import_job_rows`.
- [ ] Add integration tests for:
  - reserve + short督办 merges into one clue with both tags.
  - event lead gets `会招` tag and followup.
  - space control row creates a space.

### Task 5: Import page UI

- [ ] Add `.xlsx` file accept.
- [ ] If file is CSV, keep current CSV path.
- [ ] If file is XLSX:
  - parse workbook in browser.
  - call preview endpoint.
  - render counts and first 20 preview rows.
  - confirm import posts normalized payload.
- [ ] Show AI/config errors clearly.

### Task 6: Verification and deployment

- [ ] Run `npm run test:run`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run e2e`.
- [ ] Configure production `OPENCODE_GO_API_KEY` as a Cloudflare Pages secret/env var.
- [ ] Push only from `main` after all checks pass.
