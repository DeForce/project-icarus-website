# 0007 — Nuxt Terminal

Status: Draft for user review. No implementation is authorized until this specification and its plan are approved.
Date: 2026-11-03.

## Intent

Reimplement the ICARUS ship terminal from scratch as one small Nuxt application. The project is a home hobby application: a believable ship computer for the crew of HMS _Peregrine_ and a practical content tool for the game master. The previous Vue/Nest implementation and all earlier plans/specs except the tooling pair 0003 are discarded; the agreed terminal visual design, the domain model and the YAML v1 content format are kept.

This specification supersedes the approach of plan/spec 0006. Decisions confirmed with the owner: one Nuxt application with SSR, Zod kept for server-side validation only, no content cache of any kind, a demo seed is required, legacy artifacts (`website/` including the mockup and `website/plan.md`) are deleted, article clearance markings are deferred, and the git history is replaced with a single clean commit after acceptance.

## Decisions

- **One application.** Nuxt (Vue 3, Vite, Nitro) with SSR. No npm workspace, no separate API package, no contracts package: shared TypeScript types live in `shared/` and are imported by both server and client code. There is no wire boundary inside the project, so no DTO synchronization problem exists.
- **Stack:** Nuxt, Vue 3, TypeScript strict, Reka UI (headless components: accessibility and behavior without imposed styles — dialogs, dropdowns, tabs in admin), @nuxtjs/i18n (single Russian locale; all UI strings centralized), markdown-it (client-side article rendering, full CommonMark including tables, raw HTML disabled so it is escaped), SQLite through better-sqlite3, Drizzle ORM with Drizzle Kit migrations, Zod (server-side only), yaml, Three.js (client-only map), Vitest, Playwright, Biome, Node.js 24, npm, Docker Compose with Caddy. Fonts are self-hosted woff2 under `app/assets/fonts/`; the specific typeface is chosen later.
- **No cache.** Public reads query SQLite and project the published snapshot on every request. The expected content volume (hundreds of entities) makes this negligible. Draft content is unreachable from public routes at the SQL level (`status = 'published'` predicates), which is simpler and more auditable than any snapshot cache.
- **Fresh database.** Six-table schema created by one initial Drizzle migration. No data migration, no compatibility bridge, no adapters — the application has never held real data.
- **Demo seed.** An explicit `db:seed` command loads a day-one 2061 demo package (ship settings, a published starter package with safe glossary-style content and a small map) into an empty database. Real campaign content is later authored as YAML files converted from the Obsidian vault and imported through the normal import workflow; Obsidian itself is never read by the application.
- **YAML validation stays.** The import document and all admin request bodies are validated with Zod on the server. Zod must not appear in client bundles.
- **Deleted artifacts:** all application code under `website/`, `website/mockup/`, `website/plan.md`, the old root `package.json` command surface, and all legacy specification/plan documents except the tooling pair 0003 (which is updated in place).
- **History reset.** After the final acceptance gate the owner replaces the git history with one clean commit. Until then work commits normally.

## Scope and constraints

- Vue 3 pages reuse the accepted terminal design: dark green/amber palette, rectangular panels, readable Cyrillic typography, restrained vector map. Brief page clear, no animations beyond a short working-area clear, respect reduced motion. Direct links, Back/Forward, keyboard focus, usable touch targets at 360 px.
- Code, comments, engineering documentation and commits are English. Player-facing copy is Russian and follows the world's register: official, technical, conservative terminology per the campaign glossary (official long names; crews shorten them in fiction, the archive itself speaks in official register).
- Biome 2.6.4 remains the single formatter/linter; its current choices are authoritative: two spaces, LF, 140 columns, single quotes, semicolons as needed, trailing commas. Full Vue template support stays enabled.
- Obsidian stays read-only reference material: never edited, never imported automatically, never included in builds. `docs/superpowers/` and the tooling scripts remain; document IDs keep increasing globally.
- Docker Compose with a host bind directory (`db/`) for SQLite, HTTP-only Caddy, TLS externally. Local development and all tests run without Docker. No secrets or databases enter git.
- The project is unreleased. No old API, client or YAML adapters are kept. Conventional English commits at verified milestones; no push, no branches without a separate request.

## Product and interaction

Public (anonymous) routes: home/services, archive (category tree, server-side search, article detail with related links), star map, received-packages journal (list and detail), and the fictional «crew login unavailable» page. Real administrator login lives at a separate route.

Admin routes (authenticated): dashboard; campaign settings (ship name, current date); package list and draft editor (metadata, entity changes by kind, preview with reference errors, publish); YAML import page (file or pasted text, preview, confirm, import).

Publication semantics: a package publishes at any time regardless of dates — the game master may publish packages «into the future». Public routes expose only content from published packages whose `receivedDate` is not later than the campaign `currentDate`; changing `currentDate` publishes nothing by itself, it only advances what the crew can see. Reference validation at publication checks the projected state visible **as of the package's own `receivedDate`**, so any publicly visible snapshot is self-consistent. A published package is immutable, corrections ship in later packages; `effectiveDate` describes the information and is not a visibility filter.

## Data model

Six tables, all access through Drizzle:

- `campaign_settings` — singleton row (id = 1): `shipName`, `currentDate`, `revision`.
- `information_packages` — `id`, `title`, `publicSummary`, `receivedDate`, `status` (`draft`/`published`), `publishedAt`, `sequence` (unique, assigned at publication), `revision` (bumped by every draft write).
- `entities` — `id`, `kind` (`category`/`article`/`system`/`route`).
- `package_changes` — `entityId` + `packageId` (unique pair), `operation` (`upsert`/`remove`), `payloadJson` (typed JSON payload for upserts), `effectiveDate`, `source`.
- `import_package_keys` — `key` → `packageId`.
- `import_entity_keys` — `kind` + `key` → `entityId`.

Payload shapes are shared TypeScript interfaces: category (name, parentId, order), article (title, categoryId, bodyMarkdown, relatedArticleIds), system (name, astronomy block with designation/RA/Dec/distance/spectralType/catalogSource/epoch, faction, worldClass, population, economy, anchors, description, articleId), route (fromSystemId, toSystemId, type, status, direction, operator, minimumJumpOrder, description, articleId).

Optimistic concurrency is package-level only: every draft write carries `expectedPackageRevision`, checked inside the transaction; a conflict returns 409 and leaves form values intact. There are no per-entity revision or generation tables.

## Backend shape

Nitro server routes under `server/api/` split into `public/` and `admin/`; a server middleware guards `/api/admin/**` except the login endpoint. Domain logic lives in plain TypeScript modules under `server/domain/`: pure projection (last published change per entity → snapshot), pure reference checks (missing references, category cycles, self-routes), package mutation/publish transactions, and the YAML import pipeline. Database code stays in `server/database/` (schema, client, official `migrate()` on boot, backup CLI, seed). No generic repositories, no service-forwarding layers, no event machinery.

Reads build the snapshot by selecting published changes — only from packages whose `receivedDate` is not later than the campaign date (or an explicitly requested as-of date) — and projecting them; there is no materialized table and no in-memory snapshot. Article lists return summaries; detail returns full Markdown. Search is case-insensitive substring matching (`LIKE`) over article titles and bodies; category filtering runs in SQL.

Validation is explicit Zod schemas per endpoint, colocated with the route. Article bodies render client-side through markdown-it with raw HTML disabled, so any HTML in source is escaped.

## Authentication

One administrator username/password from environment variables. Login compares credentials on the server and issues a cryptographically random opaque token in an HttpOnly SameSite cookie (`Secure` enabled via configuration for the externally managed HTTPS deployment). Sessions live in a process-memory map with a twelve-hour expiry; logout deletes the session; a server restart requires login again. No password hashes, fingerprints, session tables or rate-limit machinery.

## YAML import (format v1 unchanged)

The human-authored content format keeps version 1 exactly as documented: `version: 1`, `package` header (`key`, `title`, `receivedDate`, optional `publicSummary`, `source`, `effectiveDate`), typed `categories`/`articles`/`systems`/`routes` sections with stable per-kind keys, key-or-UUID references (forward references allowed), `remove` entries, per-record `source`/`effectiveDate` overrides, defaults for omitted fields. Limits: 8 MiB UTF-8, one document, 1–5000 changes, duplicate keys rejected, anchors/aliases/custom tags and `---` document splitting rejected. Unknown fields are rejected. Import errors carry YAML syntax positions and semantic paths (for example `articles[0].category`).

Pipeline: `parse` (safe YAML load + Zod validation, no database) → `plan` (resolve keys and UUIDs to entity ids, allocate provisional UUIDs for new entities, no writes) → preview endpoint returns the plan and the projected snapshot → import endpoint revalidates `expectedPackageId`/`expectedPackageRevision` plus current references inside one transaction and writes the complete draft or nothing.

A repeated `package.key` replaces the entire existing draft (metadata, manual edits and omitted entries included); omitted entries cancel draft changes without touching published records; a published package key is rejected with 409. Import never publishes and never changes the campaign date.

## Frontend shape

`app/` holds the Nuxt app: a terminal shell layout, feature pages (home, archive, map, packages, login placeholder, admin), reusable terminal components, and composables for remote state and the package editor. All UI strings live in a single Russian locale through @nuxtjs/i18n; player-facing copy stays Russian. Admin forms own their dirty/saved baselines; saving one form never clobbers another dirty form; publication is blocked until relevant forms are saved or explicitly discarded; a 409 asks the user to reload deliberately and keeps entered text. Search input and results synchronize with the route for Back/Forward. Three.js scene and Markdown rendering are client-side components with cleanup on unmount and a readable non-WebGL fallback for the map.

## Map

Systems carry real RA/Dec/distance with catalog source and epoch; Sol sits at the origin; the ly-per-parsec factor is 3.26156. Missing coordinates keep the system in the list without a marker. The scene keeps orbit/zoom/reset, selection synced to the URL query, labels/grid/routes toggles, world-class and status filters applied to list and scene together, a legend and text cards. No invented astronomy and no auto-import of lore.

## Demo seed

`npm run db:seed` loads into an empty database: campaign `HMS Peregrine` at `2061-01-01`, plus one published day-one package — ship information article, a compact in-world glossary excerpt (Переход, оболочка, метрический якорь, Считатель with official definitions), Sol and one or two nearby systems with real catalog data, one example route. Seed content is marked as demo in its `source` field and is safe for players. Seeding is explicit and never runs as part of normal startup.

## Backup

`npm run db:backup` opens the configured database read-only with `fileMustExist` and copies it through the SQLite backup API to a timestamped file under `backups/`. It never initializes, migrates or creates the source, needs no admin credentials, and restores committed WAL data. There is no automatic pruning; the owner removes old copies manually.

## Deployment

Compose runs one non-root Node container (Nuxt SSR on an internal port, `/api/health`) and one Caddy container serving HTTP in front of it. The SQLite file lives on a host bind mount (`./db:/data/db`). Environment examples document every variable. Local development uses `./.data/` instead. One documented one-time Linux directory-ownership step; no host-permission automation.

## Verification

Vitest covers projection, reference checks, YAML parsing/planning, revision conflicts and publication gating on temporary databases. Playwright covers public pages, archive search/history, package privacy (drafts absent before publication, a separate anonymous context), admin CRUD, import preview/replace/conflict flows, and the map with and without WebGL. Final gate: `npm run format:check`, `npm run check` (types, unit tests, build), `npm run db:check` (no-op generation), and the full e2e suite. Docker build and smoke test run on a Docker-capable host with fake credentials and a temporary bind directory; unavailability is recorded honestly.
