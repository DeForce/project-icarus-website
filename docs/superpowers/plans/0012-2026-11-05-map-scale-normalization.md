# 0012 — Map Scale Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All star systems always fit inside the fixed 3D scene grid by linearly normalizing scene positions, regardless of real-world distances.

**Architecture:** A pure function in `app/utils/map-scale.ts` computes a single scale factor from the largest scene-space position length; `StarScene.client.vue` applies it to marker, label, and route-line positions after building unscaled positions from equatorial coordinates. Marker sizes, grid size, and camera logic stay unchanged — they already operate in scene coordinates.

**Tech Stack:** Nuxt 3, Vue 3, three.js, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/0012-2026-11-05-map-scale-normalization-design.md`.

## Global Constraints

- Identifiers, code comments and commit messages in English; UI copy stays Russian.
- Biome: run `npm run format` after edits, `npm run check` must pass before the plan is declared complete.
- Do not touch `content/` packages, `content/content.test.ts`, the database, or server-side code — scaling is purely client-side and presentational.
- E2E specs (`tests/e2e/map.spec.ts` and others) must pass unmodified; real parsec/light-year values stay in the system card and list.
- Scene grid stays `GridHelper(20, 20)` (±10 units); scene center is Sol.

## Review Focus

- **Degenerate data (all systems at the origin or none with coordinates):** scale must fall back to 1 and the scene must still render — pinned in Task 1 unit tests.
- **Re-fit when data changes:** adding a farther system must shrink all previous positions proportionally, not leave old positions stale — pinned in Task 1 unit tests and covered by the existing `rebuildContent` watcher in Task 2.
- **Three-system scene (e2e seed):** two close stars plus one far one must all remain inside the grid and selectable — covered by the unmodified `tests/e2e/map.spec.ts`.
- **Labels and route lines:** they must move with their markers after scaling (route `icarus-route` spans Sol→LHS 1140) — verified by manual check in Task 2.

---

### Task 1: Pure scale function with unit tests

**Files:**
- Create: `app/utils/map-scale.ts`
- Test: `app/utils/map-scale.test.ts`

**Interfaces:**
- Produces:
  - `export const MAP_FIT_RADIUS: number` — `8.5` (grid half-size 10 minus visual margin for marker radius and label).
  - `export function computeMapScale(maxDistance: number): number` — returns `MAP_FIT_RADIUS / maxDistance` when `maxDistance > 0`, otherwise `1`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { computeMapScale, MAP_FIT_RADIUS } from './map-scale.ts'

describe('computeMapScale', () => {
  it('returns 1 when there is no extent (all systems at the origin)', () => {
    expect(computeMapScale(0)).toBe(1)
  })

  it('scales the farthest system to the fit radius', () => {
    const scale = computeMapScale(48.83) // LHS 1140 scene distance in light years
    expect(48.83 * scale).toBeCloseTo(MAP_FIT_RADIUS, 6)
  })

  it('scales a nearer system below the fit radius', () => {
    const scale = computeMapScale(48.83)
    expect(4.02 * scale).toBeLessThan(MAP_FIT_RADIUS) // e.g. Proxima Centauri
  })

  it('re-normalizes when a farther system appears', () => {
    const before = computeMapScale(48.83)
    const after = computeMapScale(200)
    expect(200 * after).toBeCloseTo(MAP_FIT_RADIUS, 6)
    expect(after).toBeLessThan(before)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/utils/map-scale.test.ts`
Expected: FAIL — cannot resolve `./map-scale.ts`.

- [ ] **Step 3: Implement `computeMapScale` in `app/utils/map-scale.ts`**

One function plus the constant; guard degenerate input with `if (!(maxDistance > 0)) return 1`. No other exports.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/utils/map-scale.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add app/utils/map-scale.ts app/utils/map-scale.test.ts
git commit -m "feat(map): add scene scale normalization utility"
```

### Task 2: Apply scale in StarScene and verify

**Files:**
- Modify: `app/components/StarScene.client.vue` (the `rebuildContent` function, roughly lines 70–115, and the `systemPosition` helper at lines 37–42)

**Interfaces:**
- Consumes: `computeMapScale`, `MAP_FIT_RADIUS` from `../utils/map-scale.ts` (Task 1).
- Produces: no new exports — component props/emits unchanged; `data-markers` dataset attribute unchanged.

- [ ] **Step 1: Restructure `rebuildContent` to a two-pass build**

First pass: build unscaled `Map<string, THREE.Vector3>` of system positions from `systemPosition(system)` (skip `null`s), compute `maxLength = max(position.length())` (0 when empty), then `const scale = computeMapScale(maxLength)`. Second pass: create each marker/label at `position.clone().multiplyScalar(scale)`; route lines connect scaled endpoint positions. `fitInitialCamera`, `centerOn`, `resetView`, marker radius `0.09`, and `GridHelper(20, 20)` stay exactly as they are.

- [ ] **Step 2: Verify unit and type checks**

Run: `npm run check`
Expected: PASS (lint, typecheck, unit, build) — no e2e here.

- [ ] **Step 3: Run the e2e suite**

Run: `npx playwright test`
Expected: all pass, including unmodified `tests/e2e/map.spec.ts` (3-system scene: selection, filters, WebGL fallback).

- [ ] **Step 4: Manual visual check on a dev server**

Run a throwaway dev server on port 3211 against the local `.data/icarus.sqlite` DB, open `/map`, confirm: LHS 1140 sits inside the grid near radius 8.5, Sol is at the center, labels are readable, «Центрировать» and «Сбросить вид» behave as before, and the real distance (14.96 pc / 48.80 ly) still shows in the system card. Stop the server afterwards.

- [ ] **Step 5: Commit**

```bash
git add app/components/StarScene.client.vue
git commit -m "feat(map): normalize star scene scale to fixed grid"
```

### Task 3: Final checks and plan completion

**Files:**
- Modify: `docs/superpowers/plans/0012-2026-11-05-map-scale-normalization.md` (check off tasks, record verification)
- Modify: `docs/superpowers/specs/0012-2026-11-05-map-scale-normalization-design.md` (status Draft → Approved/Done per repo convention)

- [ ] **Step 1: Run full project checks**

Run: `npm run check`
Expected: PASS. Fix any fallout from Tasks 1–2 before proceeding.

- [ ] **Step 2: Update plan/spec status and record verification results and limitations**

Note the real verification output (unit counts, e2e pass/fail, manual check outcome) and any limitations in the plan document.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/0012-2026-11-05-map-scale-normalization.md docs/superpowers/specs/0012-2026-11-05-map-scale-normalization-design.md
git commit -m "docs: record 0012 map scale normalization verification"
```
