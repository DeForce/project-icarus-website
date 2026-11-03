# 0003 — Project tooling and code standards

> Updated 2026-11-03 for the Nuxt terminal rewrite (specification 0007). Tooling decisions below remain in force; stack-specific details they mention (npm workspace, Nest application, `website/` paths, 100-column double-quote formatting) are superseded by the current Biome configuration and the layout defined in specification 0007.

## Intent

Make the application readable and reproducible, replace its custom migration runner with Drizzle's official APIs, establish numbered planning documents and commit completed plans.

## Decisions

- Biome 2.6.4 formats/lints supported application files, including Vue template/script/style sections. The authoritative choices are two spaces, LF, 140 columns, single quotes, semicolons as needed and trailing commas. EditorConfig covers shared editor defaults.
- Code/comments/commits/new technical guidance are English. Player-facing Russian copy stays Russian.
- A complete Drizzle schema, Drizzle Kit config and generated migration metadata become authoritative. Databases use official `migrate()`. The complete application schema lives at `server/database/schema.ts` (specification 0007); only checked-in Drizzle history is supported.
- Existing specs/plans receive IDs 0001 and 0002; this task is 0003. New pairs receive the next global ID before their date. Links and a document index are updated.
- `AGENTS.md` and `CONTRIBUTING.md` persist coding and verification rules. Completing a plan now includes an English Conventional Commit. Existing verified terminal/import work is captured in catch-up commit `3802617`; this plan gets a separate commit.

## Scope

Format existing application sources, fix actionable diagnostics without changing gameplay, extract complex inline template handlers, add scripts for lint/format/schema generation/document creation, and test migrations and document numbering. Obsidian and the historical mockup are excluded. CI, dependency automation and larger domain refactors are recommendations for subsequent work, not silently added infrastructure.

## Verification

Run format twice to establish idempotence, lint/typecheck/tests/build, migration initialization and restart tests, a no-op Drizzle generation check, document-numbering tests, all browser tests, and inspect the final diff before committing. Docker runtime remains unavailable in this environment.
