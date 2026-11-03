# 0009 — Package Unpublish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the game master revert any published package to draft, guarded so the public archive can never be left with references broken by the revert; deletion stays draft-only.

**Architecture:** One new domain operation in `server/domain/packages.ts` next to `publishPackage`, one thin Nitro route mirroring the publish route, and an unpublish action in the admin package editor. Publication keeps an existing `sequence` so a republished package regains its original journal place.

**Tech Stack:** Nuxt 4 (Nitro), Vue 3, TypeScript strict, Drizzle ORM on better-sqlite3, Zod (server-side), Vitest, Playwright, Biome.

**Spec:** `docs/superpowers/specs/0009-2026-11-03-package-unpublish-design.md`.

## Global constraints

- Every draft write carries `expectedPackageRevision` and bumps the revision inside one transaction; a conflict throws `PackageConflictError` (HTTP 409).
- Code/comments/commits in English; player-facing UI strings Russian, official register; Biome: two spaces, LF, 140 columns, single quotes.
- Zod appears only in server code. No content cache; public reads project from SQLite per request.
- Publication validation, future-date gating and import semantics of spec 0007 stay untouched.
- Existing test `server/domain/packages.test.ts` «publishes a valid package, assigns a monotonic sequence and makes it immutable» keeps passing: draft mutations of published packages stay rejected.

## Review Focus

1. A later published package's **remove** change (no payload) touching the package's entity must NOT block the unpublish — only payload references block (a remove projects to nothing; the archive stays consistent).
2. A blocked unpublish returns 409 carrying the blocking package titles, and the admin UI shows them — it must not be swallowed by the generic revision-conflict banner.
3. Republish after unpublish keeps the original `sequence` even when another package was published in between; fresh publishes still get `max + 1`.
4. After a successful unpublish the package and its entities disappear from all public routes for an anonymous reader immediately.
5. Two admin tabs racing the same unpublish: exactly one succeeds, the other gets 409 and a reload banner.

---

### Task 1: Domain `unpublishPackage` and republish sequence keeping

**Files:**
- Modify: `server/domain/packages.ts` (new error class, new operation, one-line change in `publishPackage`)
- Test: `server/domain/packages.test.ts`

**Interfaces:**
- Produces: `export class UnpublishBlockedError extends Error` with `readonly blockers: ReadonlyArray<{ id: string; title: string }>`; `export function unpublishPackage(db: TerminalDatabase, packageId: string, expectedRevision: number): PackageInfo`; `publishPackage` assigns `sequence: row.sequence ?? (last?.sequence ?? 0) + 1` (drafts reverted from publication keep their sequence).

- [ ] **Step 1: Write the failing tests** in `server/domain/packages.test.ts` (follow the existing temp-database fixture style of that file):

```ts
it('reverts a published package to draft and hides it from the public projection', () => {
  // publish a draft with one upserted entity; unpublishPackage(db, id, revisionAfterPublish)
  // expect returned status 'draft', publishedAt null, sequence kept;
  // projectSnapshot(db, { asOfDate }) no longer contains the entity
})

it('blocks the unpublish when a later published package references its entity', () => {
  // package A publishes article X; package B (later sequence) upserts article Y with relatedArticleIds [X]; publish B
  // expect unpublishPackage(db, A, ...) to throw UnpublishBlockedError
  // whose blockers contain B's id and title
})

it('does not block when a later package only removes the entity', () => {
  // package B removes X (remove change has no payload) — unpublish A succeeds
})

it('rejects the unpublish on a revision conflict', () => {
  // unpublishPackage with a stale expectedRevision throws PackageConflictError
})

it('republish after unpublish keeps the original sequence', () => {
  // A publishes (sequence 1), B publishes (sequence 2); unpublish A; publish A again
  // expect A's sequence still 1; then create fresh C, publish, expect sequence 3
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run server/domain/packages.test.ts`
Expected: FAIL — `unpublishPackage` is not exported (test file fails to import/compile).

- [ ] **Step 3: Implement in `server/domain/packages.ts`**

- `UnpublishBlockedError` with the blockers field from the Interfaces block.
- Reference collection helper: `referencedIds(payload: EntityPayload): string[]` gathering values of the reference keys (`parentId`, `categoryId`, `articleId`, `fromSystemId`, `toSystemId`, plus elements of `relatedArticleIds`) — kind-agnostic over the typed payloads.
- `unpublishPackage`, one transaction:
  1. `getPackageRow`; throw `PublicationError('Only a published package can be reverted to draft')` unless `status === 'published'`; `row.revision !== expectedRevision` → `PackageConflictError`.
  2. Entity ids upserted by this package: `select entityId from packageChanges where packageId = ? and operation = 'upsert'`.
  3. Guard: join `packageChanges` with `informationPackages` on `status = 'published'` and `sequence > row.sequence`; for rows with non-null `payloadJson`, parse and collect `referencedIds`; if any id is in the upserted set, add the owning package to a `Map<string, { id, title }>` of blockers. Non-empty → throw `UnpublishBlockedError([...blockers.values()])`.
  4. `bumpExpectedRevision(tx, packageId, expectedRevision)` then `tx.update(informationPackages).set({ status: 'draft', publishedAt: null })`.
  5. Return `toPackageInfo(getPackageRow(db, packageId))`.
- In `publishPackage`, change the `sequence` field to `row.sequence ?? (last?.sequence ?? 0) + 1`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run server/domain/packages.test.ts`
Expected: all tests pass, including the pre-existing suite.

- [ ] **Step 5: Commit**

```bash
git add server/domain/packages.ts server/domain/packages.test.ts
git commit -m "feat: add guarded unpublish for published packages"
```

### Task 2: Unpublish endpoint and error mapping

**Files:**
- Create: `server/api/admin/packages/[id]/unpublish.post.ts`
- Modify: `server/utils/http.ts`
- Test: covered by Task 3 e2e; no per-handler unit tests exist in this repo by convention.

**Interfaces:**
- Consumes: `unpublishPackage`, `UnpublishBlockedError` from Task 1.
- Produces: `POST /api/admin/packages/:id/unpublish` with strict Zod body `{ expectedPackageRevision: number }`; `UnpublishBlockedError` maps to HTTP 409 with `data: { blockers }`.

- [ ] **Step 1: Create `server/api/admin/packages/[id]/unpublish.post.ts`** mirroring `publish.post.ts` (same guard, same Zod schema shape, calls `unpublishPackage`).

- [ ] **Step 2: Map the error in `server/utils/http.ts`:** before the generic rethrow, `if (error instanceof UnpublishBlockedError) throw createError({ statusCode: 409, statusMessage: error.message, data: { blockers: error.blockers } })`; import the class.

- [ ] **Step 3: Verify types and lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add server/api/admin/packages server/utils/http.ts
git commit -m "feat: expose unpublished package endpoint with blocker reporting"
```

### Task 3: Admin UI action, list navigation, and e2e

**Files:**
- Modify: `app/composables/usePackageEditor.ts`
- Modify: `app/pages/admin/packages/[id].vue`
- Modify: `app/pages/admin/index.vue`
- Modify: `i18n/locales/ru.json`
- Test: `tests/e2e/admin-workspace.spec.ts`

**Interfaces:**
- Consumes: the Task 2 endpoint.
- Produces: `unpublish(): Promise<boolean>` and `unpublishBlockers: Ref<Array<{ id: string; title: string }>>` on the package editor composable; admin list rows for published packages navigate to `/admin/packages/:id`.

- [ ] **Step 1: Extend `usePackageEditor`** with `unpublishBlockers` ref and an `unpublish()` that does NOT use the generic `run()` helper (a blocked unpublish is also 409 and would be misread as a revision conflict):

```ts
async function unpublish(): Promise<boolean> {
  unpublishBlockers.value = []
  saving.value = true
  conflict.value = false
  try {
    await ofetch(`${packageUrl}/unpublish`, { method: 'POST', body: { expectedPackageRevision: revision.value } })
    await load()
    return true
  } catch (error) {
    if (isConflict(error)) {
      const blockers = (error as { data?: { blockers?: Array<{ id: string; title: string }> } }).data?.blockers
      if (blockers) {
        unpublishBlockers.value = blockers
      } else {
        conflict.value = true
        await load()
      }
      return false
    }
    throw error
  } finally {
    saving.value = false
  }
}
```

Export both new members.

- [ ] **Step 2: Published view in `app/pages/admin/packages/[id].vue`:** in the `<template v-else>` (published) branch add a «Вернуть в черновик» section: button (`window.confirm(t('editor.unpublishConfirm'))` first, following the `onDeleteDraft` pattern), on success nothing else to do (the detail reload flips the view to the draft editor); below it, `v-if="unpublishBlockers.length > 0"` renders `t('editor.unpublishBlocked')` plus a list of blocker titles.

- [ ] **Step 3: Admin list in `app/pages/admin/index.vue`:** `packageTo` returns `/admin/packages/${id}` for published packages too, so the action is reachable from the list; the admin detail page shows the published view with the new action.

- [ ] **Step 4: i18n keys** in `i18n/locales/ru.json` under `editor`:

```json
"unpublish": "Вернуть в черновик",
"unpublishConfirm": "Пакет исчезнет из публичного журнала и станет редактируемым черновиком. Продолжить?",
"unpublishBlocked": "Возврат в черновик невозможен: сущности пакета используются более поздними публикациями."
```

- [ ] **Step 5: E2E scenarios** in `tests/e2e/admin-workspace.spec.ts`, reusing that file's existing login/draft/publish helpers:

```ts
test('unpublish is blocked while a later published package references its entity', async ({ page }) => {
  // publish package A containing article X (via the existing draft/publish flow)
  // publish package B whose article Y lists X as related
  // open A's admin detail, click «Вернуть в черновик», confirm
  // expect the blocked message naming B's title; A is still published
})

test('reverting the later package first unblocks the revert, and the archive hides the content', async ({ page, browser }) => {
  // unpublish B (succeeds — no later references), then unpublish A (succeeds)
  // in a fresh anonymous context, the public packages journal no longer lists either package
})
```

- [ ] **Step 6: Run gates**

Run: `npm run check` then `NUXT_IGNORE_LOCK=1 npx playwright test tests/e2e/admin-workspace.spec.ts`
Expected: unit suite green; both new e2e scenarios pass.

- [ ] **Step 7: Commit**

```bash
git add app i18n tests
git commit -m "feat: add revert-to-draft action for published packages"
```

## Self-review notes

- Spec coverage: dependency guard (Task 1 guard), any-package revert (no latest-only restriction), sequence keeping (Task 1 step 3 + test), `publishedAt` reset, 409-with-blockers mapping (Task 2), UI action with confirm and blocker display (Task 3), draft delete unchanged, public invisibility (Task 1 + Task 3 e2e), narrowing of the immutability claim (covered: existing immutability test untouched, unpublish is a new distinct operation).
- Approach call recorded: the admin list gains the action via navigation (published rows open the admin detail) instead of per-row buttons — same capability, less crowded list.
