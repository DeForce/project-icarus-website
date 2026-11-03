# 0008 — Editor Reference Pickers Implementation Plan

Status: Completed.

**Spec:** `docs/superpowers/specs/0008-2026-11-03-editor-reference-pickers-design.md`.

## Context

Milestone 5 shipped the draft editor. Real usage surfaced: draft entities missing from the
reference index, a checkbox list for related articles that cannot scale, free-text spectral
class, and ungrouped large integers. `projectSnapshot` already supports a `draftPackageId`
overlay, so the server side reuses the same projection preview/publish use.

## Tasks

- [x] Move index construction into `server/domain/entity-index.ts` (`buildEntityIndex(db, draftPackageId?)` with `draftOnly` marking); cover base/overlay/fallback with unit tests.
- [x] Accept `?packageId=` in `GET /api/admin/entity-index`; move `EntityIndexEntry` to `shared/types.ts`; pass the editor package id from `app/pages/admin/packages/[id].vue` and mark draft-only options.
- [x] Implement `app/components/admin/EntityPicker.vue` (single + multi, search, keyboard) with Russian locale strings; i18n keys under `editor.picker`.
- [x] Implement `app/components/admin/GroupedNumberInput.vue` (thousand grouping, integer parse, safe-integer cap).
- [x] Rewire `ChangeEditor.vue`: all entity references to `EntityPicker` (related articles multi), spectral class `datalist`, population via `GroupedNumberInput`; delete `EntityRefSelect.vue`.
- [x] Add e2e regression scenarios (draft category selectable in article form, multi picker add/remove, grouped population display and persistence).
- [x] Run `npm run format`, `npm run check`, `npm run test:e2e`; record real verification and limitations.
- [x] Create an English Conventional Commit for this completed plan.

## Verification

- `npm run format` — Biome formatted all files, no pending fixes.
- `npm run check` — Biome 97 files, no errors; `nuxt typecheck` clean; 40 unit tests passed
  (6 files, including the new `server/domain/entity-index.test.ts`); production build completed.
- `npm run test:e2e` — 38 passed (access, admin-workspace, public-pages; desktop and phone
  projects). New scenario `editor references draft entities: category picker, related
  articles, grouped population` covers the draft-category selection end to end.

Found and fixed en route: the entity index was fetched once per page load, so entities saved
during the session never reached the pickers; the editor page now refreshes the index after
successful change save/cancel.

## Limitations

- `EntityPicker` renders options as plain buttons instead of `role=listbox/option`
  markup: Biome's a11y rules reject interactive ARIA roles on `ul/li`, and buttons stay
  accessible by default. Keyboard navigation (arrows/Enter/Escape) is implemented.
- `GroupedNumberInput` reformats on every input; after editing in the middle of the number
  the cursor moves to the end. Acceptable for terminal-style admin forms.
- Draft-only options carry a «· черновик» name suffix but are not sorted or grouped
  separately in the dropdown.
