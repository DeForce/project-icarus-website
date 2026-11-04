# 0010 — Campaign Content Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Obsidian campaign corpus into five YAML v1 packages under `content/`, validate, import and publish them into the terminal, and leave behind a reusable conversion skill.

**Architecture:** Source texts are read-only reference in `obsidian/`; each package is one hand-converted YAML file in `content/` (git-tracked), validated by a vitest harness that runs every file through the real import pipeline on a temp database. Conversion is done per package by fresh-context workers holding only their source file. Owner review gates the reduced lexicon and previews before import.

**Tech Stack:** YAML v1 import format (`docs/package-import.md`), the existing import pipeline (`server/domain/import/*`), Vitest, `scripts/fetch-star.mjs` (SIMBAD, dev-only).

**Spec:** `docs/superpowers/specs/0010-2026-11-03-campaign-content-packages-design.md`.

## Global constraints

- Player-facing text is Russian, in-world voice: a British Imperial bureaucrat/historian of 2061 — official, technical, conservative; no meta commentary.
- Inclusion: information available to any Imperial citizen, plus Project Icarus personnel. Exclusions per spec: `obsidian/Игроки/*`, `obsidian/История/Развитие Истории до появления игроков.md`, `obsidian/1. Сюжет/`, `obsidian/История/Style Guidance.md`, registry §IV and the out-of-game source note.
- Obsidian is never modified and never enters Git/build contexts.
- Import v1 field names are exact (see Task 1 Interfaces): keys are ASCII `[A-Za-z0-9._-]` starting with letter/digit; dates `YYYY-MM-DD`; system `worldClass` ∈ `central|middle|outer|uncolonized|unknown`; route `type` ∈ `main|secondary|experimental|historical`, `status` ∈ `open|closed|dangerous|unknown`.
- `relatedArticles` links only within the same package.
- Every content change is proven by `content/content.test.ts` before commit.

## Review Focus

1. A YAML encoding slip in a 100 KB Cyrillic body (unquoted `:`, block-scalar indentation) — the validation harness must catch it via the real parser, not eyeballs.
2. Key collisions across packages or with the demo seed (`sol`) — combined validation on one temp database.
3. The `sol` system key supersedes demo data after publication — the ship-info demo article must stay consistent and the map must render both systems and the route.
4. Publication-time reference problems that import-time validation cannot see (visibility is checked as of each package's own `receivedDate`) — caught by the admin preview step before publishing.
5. A lexicon term that is attested in the corpus but wrong in-world — the owner gate exists precisely for this; the harness asserts only mechanical attestation, never canonicity.

---

### Task 1: Content validation harness

**Files:**
- Create: `content/content.test.ts`
- Create: `content/` (directory; YAML files land here from Task 3 on)

**Interfaces:**
- Consumes: `importPackageFromYaml(db, yaml, expectedPackageId, expectedPackageRevision)` from `server/domain/import/service.ts`; `createTestDatabase` from `server/database/test-utils.ts`.
- Produces: `content/` as the package directory; the contract that every `content/*.yml` must import cleanly on a temp database.

- [ ] **Step 1: Write the failing test** `content/content.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TerminalConnection } from '../server/database/client.ts'
import { createTestDatabase } from '../server/database/test-utils.ts'
import { importPackageFromYaml } from '../server/domain/import/service.ts'

const files = readdirSync(join(process.cwd(), 'content')).filter((name) => name.endsWith('.yml'))

describe('content packages', () => {
  let connection: TerminalConnection
  beforeEach(() => {
    connection = createTestDatabase()
  })
  afterEach(() => {
    connection.sqlite.close()
  })

  it('discovers the package set', () => {
    expect(files.length).toBeGreaterThanOrEqual(5)
    expect(files.sort()).toEqual([
      '2061-01-04-astro-registry.yml',
      '2061-01-01-history-imperial.yml',
      '2061-01-03-project-icarus.yml',
      '2061-01-02-reference-works.yml',
      '2061-01-05-technical-works.yml',
    ])
  })

  for (const file of [
    '2061-01-01-history-imperial.yml',
    '2061-01-02-reference-works.yml',
    '2061-01-03-project-icarus.yml',
    '2061-01-04-astro-registry.yml',
    '2061-01-05-technical-works.yml',
  ]) {
    it(`imports ${file} on a fresh database`, () => {
      const yaml = readFileSync(join(process.cwd(), 'content', file), 'utf8')
      expect(() => importPackageFromYaml(connection.db, yaml, null, null)).not.toThrow()
    })
  }

  it('imports the whole set on one database without key collisions', () => {
    for (const file of files) {
      const yaml = readFileSync(join(process.cwd(), 'content', file), 'utf8')
      expect(() => importPackageFromYaml(connection.db, yaml, null, null)).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run content/content.test.ts`
Expected: FAIL — no YAML files exist yet.

- [ ] **Step 3: Commit the harness**

```bash
git add content/content.test.ts
git commit -m "test: validate content packages through the import pipeline"
```

### Task 2: Astronomy for LHS 1140

**Files:**
- Produces: stdout values consumed by Task 5 (no file yet).

- [ ] **Step 1:** Run `node scripts/fetch-star.mjs "LHS 1140" lhs-1140 "LHS 1140"`.
- [ ] **Step 2:** Record `raDegrees`, `decDegrees`, `distancePc` (parallax-derived), `spectralType`, `designation`, `epoch` from the output for Task 5. If SIMBAD is unreachable, stop and tell the owner — do not invent values.

### Task 3: History package

**Files:**
- Create: `../../../content/2061-01-01-history-imperial.yml`
- Source: `obsidian/История/Предыстория Общая.md` (read-only)

**Interfaces:**
- Produces: package `history-imperial`, receivedDate `2061-01-01`, title «История Империи»; category `history-imperial` «История Империи»; 8 articles with keys `history-overview`, `history-firearms`, `history-religion`, `history-pharmacology`, `history-military-law`, `history-labour`, `history-monarchy`, `history-networks` — one per top-level `#` section of the source, bodies preserving the source's headings/tables/lists.

- [ ] **Step 1:** Read the source file; write `../../../content/2061-01-01-history-imperial.yml` per the Interfaces block. Header `source: Имперское историческое ведомство`, `publicSummary` in-world one-liner.
- [ ] **Step 2:** Run `npx vitest run content/content.test.ts` — the `2061-01-01-history-imperial.yml` import case passes.
- [ ] **Step 3:** Commit `git commit -m "content: add imperial history package"`.

### Task 4: Reference works package

**Files:**
- Create: `../../../content/2061-01-02-reference-works.yml`
- Source: `obsidian/История/Глоссарий.md`, `obsidian/История/Английские Дома.md`, `obsidian/Флот/*.md`, `obsidian/История/Лексикон.md` (read-only)

**Interfaces:**
- Consumes: the converted corpus bodies from Task 3 (for lexicon attestation).
- Produces: package `reference-works`, receivedDate `2061-01-02`, title «Справочник»; category `reference-works` «Справочник»; articles `ref-glossary-*` (12, one per `#` section of the glossary), `ref-houses`, `ref-officers`, `ref-ranks`, `ref-lexicon`.

- [ ] **Step 1:** Write the glossary/houses/fleet articles per the Interfaces block.
- [ ] **Step 2: Reduce the lexicon.** Extract the lexicon's terms; keep a term only if it occurs (case-insensitive, word boundary) in the bodies of the already converted packages (`content/*.yml`, demo seed excluded). Preserve the lexicon's section structure for survivors. The reduced article keeps key `ref-lexicon`.
- [ ] **Step 3:** Run `npx vitest run content/content.test.ts` — all existing cases pass.
- [ ] **Step 4:** Commit `git commit -m "content: add reference works package"`.

### Task 5: Project Icarus package

**Files:**
- Create: `../../../content/2061-01-03-project-icarus.yml`
- Source: `obsidian/История/Имперский Астрографический Реестр.md` §III only, `obsidian/История/Корабли.md` §10 (read-only)

**Interfaces:**
- Produces: package `project-icarus`, receivedDate `2061-01-03`, title «Проект Икар»; category `icarus-project` «Проект Икар»; articles `icarus-status-2061` (registry §III verbatim, it is already an in-world text) and `icarus-peregrine` (Корабли §10).

- [ ] **Step 1:** Write `../../../content/2061-01-03-project-icarus.yml` per the Interfaces block; header `source: Адмиралтейство — канцелярия проекта ICARUS`.
- [ ] **Step 2:** Run the content test; commit `git commit -m "content: add project icarus package"`.

### Task 6: Astro registry package

**Files:**
- Create: `../../../content/2061-01-04-astro-registry.yml`
- Source: `obsidian/История/Имперский Астрографический Реестр.md` §I and §II, Task 2 values (read-only source)

**Interfaces:**
- Consumes: Task 2 astronomy values.
- Produces: package `astro-registry`, receivedDate `2061-01-04`, title «Имперский астрографический реестр»; category `astro-registry` «Астрографический реестр»; articles `astro-sol` (registry §I, verbatim) and `astro-lhs-1140` (registry §II, verbatim); system `sol` (supersedes the demo entity: astronomy G2V, worldClass `central`, description and `article: astro-sol`); system `lhs-1140` (Task 2 astronomy, worldClass `uncolonized`, `article: astro-lhs-1140`); route `icarus-route` from `sol` to `lhs-1140`, type `experimental`, status `unknown`, direction `forward`, operator «Проект ICARUS».

- [ ] **Step 1:** Write `../../../content/2061-01-04-astro-registry.yml` per the Interfaces block; header `source: Имперское астрографическое управление`.
- [ ] **Step 2:** Run the content test (includes the combined no-collision case with the demo `sol` key on a fresh DB — the demo seed is not in the test DB, so no collision is expected there; collision with the live demo package is handled at import time by key resolution, and must be confirmed in Task 8).
- [ ] **Step 3:** Commit `git commit -m "content: add astrographic registry package"`.

### Task 7: Technical works package

**Files:**
- Create: `../../../content/2061-01-05-technical-works.yml`
- Source: `obsidian/История/Считатели.md`, `obsidian/История/Галлиетовые Щиты и Оружие.md`, `obsidian/История/Корабли.md` §1–9, `obsidian/История/Планетарное сообщение.md` (read-only)

**Interfaces:**
- Produces: package `technical-works`, receivedDate `2061-01-05`, title «Технические описания»; category `tech-works` «Технические описания»; articles `tech-computers` (Считатели), `tech-gallion` (Галлиетовые щиты), `tech-engines` (Корабли §1–9), `tech-planetary` (Планетарное сообщение).

- [ ] **Step 1:** Write `../../../content/2061-01-05-technical-works.yml` per the Interfaces block; header `source: Имперское техническое ведомство`.
- [ ] **Step 2:** Run `npx vitest run content/content.test.ts` — full suite green, including the combined import.
- [ ] **Step 3:** Commit `git commit -m "content: add technical works package"`.

### Task 8: Owner gate — reduced lexicon and package previews

- [ ] **Step 1:** Show the owner the reduced `ref-lexicon` article (kept/dropped term counts and the full kept list). Wait for approval or edit list.
- [ ] **Step 2:** Run the admin preview for each package against the local dev database (`DATABASE_PATH=./.data/icarus.sqlite`) and show the owner package titles, change counts and any reference problems. Fix and re-validate anything flagged.

### Task 9: Import, publish and verify on the live dev database

**Files:** none (operates on `.data/icarus.sqlite` via the running dev server).

- [ ] **Step 1:** With `npm run dev` running, log in as admin, import the five packages in receivedDate order, publishing each after its preview is clean.
- [ ] **Step 2:** Verify on public pages (anonymous context): «История Империи» shows its 8 articles and one opens with intact tables; «Справочник» renders; the map shows Sol and LHS 1140 with the ICARUS route; packages received after 2061-01-01 stay hidden from the anonymous journal (campaign date is 2061-01-01) — the history package is visible, the rest are drafts of future dates.
- [ ] **Step 3:** Report to the owner: what is visible now, what will appear as the campaign date advances, and that the demo package's Sol entry was superseded.

### Task 10: Conversion skill

**Files:**
- Create: `C:/Users/Vlad/.kimi-code/skills/obsidian-to-terminal/SKILL.md` (user scope)

- [ ] **Step 1:** Load `superpowers:writing-skills` and author the skill following it. Content: when to use (converting Obsidian vault material or authoring new in-world documents for the terminal); access rules and exclusions; the in-world voice; package/key conventions; the v1 format cheat-sheet; the lexicon attestation reduction; the SIMBAD step; the validation test; the import/publish flow; the owner review gates.
- [ ] **Step 2:** Verify the skill per writing-skills (structure/frontmatter checks), then commit any repo-side documentation reference: `git commit -m "docs: reference the obsidian conversion skill"`.

## Self-review notes

- Spec coverage: package set (Tasks 3–7), lexicon reduction (Task 4 step 2), astronomy (Tasks 2 + 6), exclusions enforced by task source lists, owner gates (Task 8), import/verify (Task 9), skill (Task 10), demo supersede verification (Task 9 step 2).
- Proportion: conversion task bodies are deliberately short — the converter needs the source text and the format, which the Interfaces blocks and the v1 schema pin; transcribing article text into the plan would be noise.

## Verification record (completed)

- Content harness: `content/content.test.ts` — all 5 packages import on a fresh database through the real `importPackageFromYaml` (7/7 after the owner date-prefix rename).
- Voice pass: 505 changed lines across 5 packages reviewed by a fresh reviewer against owner feedback (present tense for the current era); zero fact/name/number drift (machine comparison).
- Live import (local test instance): all 5 packages published №1–№5 after a full DB reset; demo package removed (it was superseded by campaign content); anonymous visibility follows the campaign date as designed.
- Conversion skill (Task 10): `~/.kimi-code/skills/obsidian-to-terminal/SKILL.md`, created with TDD per superpowers:writing-skills — baseline subagent run violated tense/lexicon/attestation/SIMBAD rules; with the skill it complies (validated on a fresh run with owner-gate questions).

## Limitations

- The LHS 1140 astronomy came from SIMBAD via the ident table (fetch-star script does not resolve the main_id directly).
- `relatedArticles` are empty across the five packages (no cross-links wired).
- Mixed-tense line in `2061-01-01-history-imperial.yml` (~line 1029) and «Рабочая реконструкция» wording in the registry article remain as documented during the voice pass.
