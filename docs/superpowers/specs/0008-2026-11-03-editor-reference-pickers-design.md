# 0008 — Editor Reference Pickers

Status: Draft.
Date: 2026-11-03.

## Intent

Fix four defects of the draft editor found in real usage:

1. A draft cannot reference entities it introduces itself: a new article cannot select a
   category created in the same draft, because the reference index is built from the published
   snapshot only.
2. Related articles are chosen through a checkbox list of every article in the archive; this
   does not scale past a few dozen entries.
3. The spectral class is free text although spectral classes are a documented closed list.
4. Large integers (population) are unreadable when typed (`10000000`), and grow worse with
   real values.

## Scope and constraints

- No new runtime dependencies: the number grouping is a small owned formatter, the picker is
  an owned component. The repository dependency policy stays strict.
- Player-facing strings stay Russian and follow the terminal register; identifiers and
  comments stay English.
- Reference validation semantics do not change: the draft overlay only widens what the
  editors can point at, exactly like the preview/publish projection already does.
- One reusable picker component covers single-value and multi-value selection and replaces
  every entity reference control in the change editor.

## Design

### Server: draft-aware reference index

- Move index construction out of the route into `server/domain/entity-index.ts`:
  `buildEntityIndex(db, draftPackageId?: string)` returns entries
  `{ id, kind, name, draftOnly }`.
- The projection is `projectSnapshot(db, { asOfDate: currentDate, draftPackageId })`, so the
  editor sees exactly what preview and publish would compute. Entries whose id appears only
  through the draft overlay get `draftOnly: true`.
- `GET /api/admin/entity-index` accepts an optional `?packageId=` query and forwards it.
  Unknown or published ids fall back to the plain snapshot.
- Shared type `EntityIndexEntry` (with `draftOnly`) moves to `shared/types.ts`; the editor
  page passes its package id and labels draft-only entries with a «черновик» marker so the
  DM can tell published and pending entities apart.

### Client: searchable entity picker

- New `app/components/admin/EntityPicker.vue`, props: `options`, `multiple?`, `nullable?`
  (single mode), `disabled?`; `v-model` is `string | null` (single) or `string[]` (multi).
- Text input filters options by case-insensitive substring; dropdown renders matches
  (scrollable), keyboard navigation (ArrowUp/Down, Enter, Escape), click-outside closes.
  Multi mode renders selected entries as removable chips above the input; single mode shows
  the selected name and allows clearing when `nullable`.
- ARIA listbox semantics (`role=combobox/listbox/option`, `aria-selected`,
  `aria-activedescendant`) keep assistive technology support explicit.
- `ChangeEditor.vue` replaces every `EntityRefSelect` usage: category parent, article
  category, system article, route endpoints (single, some nullable) and article related
  articles (multi). `EntityRefSelect.vue` is deleted once unused.
- Draft-only options render their name with a «· черновик» suffix supplied by the page.

### Spectral class

- `system.astronomy.spectralType` becomes an `<input>` with a `<datalist>` of documented
  classes: O, B, A, F, G, K, M, W, C, S, L, T, Y, D. Free text remains possible for lore
  exotics; no validation constraint changes.

### Grouped integer input

- New `app/components/admin/GroupedNumberInput.vue`: text input with `inputmode=numeric`
  that groups digits in threes with a non-breaking space while typing (`10 000 000`),
  parses back to an integer (empty → `null`), caps at `Number.MAX_SAFE_INTEGER`.
- Used for `system.population` now; any future large-integer field reuses it.

## Verification

- Unit tests for `buildEntityIndex`: base snapshot entries are `draftOnly: false`; entities
  introduced by the draft appear with `draftOnly: true`; an unknown package id falls back to
  the plain snapshot.
- e2e regression in `tests/e2e/admin-workspace.spec.ts`: create a draft, add a category,
  open the article form and select that category through the picker; add a related article
  through the multi picker and remove it; population typing `10000000` displays grouped
  digits and saves as an integer; values survive re-opening the change.
- `npm run check` plus `npm run test:e2e` before the Conventional Commit.
