# 0009 — Package Unpublish

Status: Draft.
Date: 2026-11-03.

Amends specification 0007 («A published package is immutable»): publication stays a deliberate, revision-checked act, but the game master can revert a published package to draft. Draft deletion already exists; this adds the missing half of the mistake-recovery story.

## Intent

The game master may publish a package by mistake. Today the only recovery is shipping corrective packages, which is heavy for a hobby campaign. The terminal must let the game master select any published package and send it back to draft, without ever leaving the public archive in a dangling-reference state. Deleting a draft stays as it works today.

## Goals

- Revert any published package to draft (`status` → `draft`), after which it behaves exactly like a normal draft: editable, publishable again, deletable.
- The public archive never shows references broken by an unpublish: the operation is blocked when later published packages depend on the package's entities.
- Full auditability stays: every write carries `expectedPackageRevision`; the operation runs in one transaction.

## Non-goals

- No cascade unpublish (unpublishing dependent packages together).
- No editing published content in place; the fix flow is unpublish → edit → republish.
- No new visibility semantics: a reverted package disappears from public routes exactly like any draft.

## Anti-goals

- Silent public inconsistency: a mid-history unpublish that makes later published articles point at vanished entities.

## Constraints

- Publication still assigns a monotonic sequence; a republished package keeps its original journal place.
- Zod stays server-side; Biome conventions; English code and docs, Russian UI strings.
- Existing plan-0007 semantics remain otherwise untouched: publication validation, future-date gating, import replace rules.

## Approaches

- **A. Free unpublish of any package.** One click, minimal code, but a mid-history unpublish can leave the public archive dangling until the game master repairs and republishes by hand.
- **B. Dependency-guarded unpublish (chosen).** Any package can be reverted, but the server first checks whether later published packages reference entities this package upserted. If they do, the operation is rejected with the list of blocking packages; otherwise it proceeds. Chosen: it preserves the game master's freedom (the mistaken package is almost always the latest, which passes the guard instantly) while the crew can never see a broken archive.
- **C. Warn-only dialog.** Same check rendered as a confirmation instead of a block. Rejected: a confirm dialog read too quickly still ships inconsistency, and the block message teaches the recovery order (unpublish newer packages first).

## Design

- New domain operation `unpublishPackage(db, packageId, expectedPackageRevision)` in `server/domain/packages.ts`:
  - Loads the package; only `status = 'published'` qualifies (drafts are deleted, not unpublished). Revision checked inside one transaction, bumping it on success like every draft write.
  - Guard: collect entity ids upserted by this package (changes with `operation = 'upsert'`). Scan changes of packages published later (greater `sequence`) for payloads referencing any of those ids (article `categoryId`/`relatedArticleIds`, category `parentId`, system `articleId`, route `fromSystemId`/`toSystemId`/`articleId`). Any hit → domain error listing the later package ids/titles, mapped to 409 by the existing error handling.
  - Success: `status` → `draft`, `publishedAt` → null, `sequence` kept so a later republish keeps the original journal order; publication assigns a fresh `max + 1` sequence only when `sequence` is null.
- Endpoint `POST /api/admin/packages/:id/unpublish` with a strict Zod body `{ expectedPackageRevision }`, guarded by the existing admin middleware.
- Admin UI: published packages get a «Вернуть в черновик» action (package detail and list) with a confirmation step; a 409 response shows the blocking packages and keeps the user on the page. Draft delete stays unchanged.
- Unit tests on temporary databases: revert latest package; revert mid-history package free of later references; revert blocked when a later published package references its entity (message names the blocker); revision conflict on unpublish; republish after unpublish restores journal order (original sequence kept); publication still assigns monotonic sequences for fresh packages; public projection hides the reverted package immediately.
- E2E: admin reverts a just-published package, edits a field, republishes; blocked unpublish shows the blocker list; drafts remain invisible to anonymous contexts afterwards.

## Verification

`npm run check`, focused unit suite, and the admin e2e scenarios above pass. Existing plan-0007 tests that assert «published packages reject every mutation» are narrowed to «reject every mutation except unpublish».
