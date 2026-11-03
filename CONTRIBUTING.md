# Development standards

## Language and naming

Use English for code, identifiers, comments, commit messages and new engineering documentation. Russian is appropriate for player-facing copy, campaign material and human-readable validation messages. Player-facing copy uses the campaign's official register: conservative, technical terminology per the campaign glossary.

Use `camelCase` for values/functions, `PascalCase` for types/classes/Vue SFCs, `UPPER_SNAKE_CASE` for true constants and `kebab-case` for other source filenames. Boolean names should describe a condition (`isLoading`, `hasChanges`, `canPublish`). Avoid abbreviations unless conventional in the domain.

Use interfaces for public object contracts and type aliases for unions/mapped types. Keep strict TypeScript enabled. Validate untrusted data at API/file boundaries with server-side Zod schemas; shared types in `shared/` are plain TypeScript and never import Vue, Nitro, Drizzle or Node environment modules. Prefer narrowing and explicit nullable values over `any` and assertions. Use `import type` when no runtime value is required.

## Formatting and linting

Biome is the single formatter/linter for supported source and configuration files. Configuration is at the repository root. Use two spaces, LF, UTF-8, 140-column formatting, single quotes, semicolons as needed and trailing commas. Full HTML/Vue support is explicitly enabled; the pinned Biome version must format template, script and style sections.

Run `npm run format` to format files, `npm run lint` for non-mutating diagnostics, and `npm run lint:fix` for safe lint/format/import fixes. `npm run check` includes lint, type checks, unit tests and build. Do not silence a rule across the repository to avoid fixing one file. Files unsupported by the pinned formatter follow EditorConfig and their own validators; do not introduce a second formatter without discussion.

Generated dependencies, build output (`.nuxt/`, `.output/`), migration metadata snapshots, lockfiles and the generated document index are excluded from hand-formatting. `obsidian/` is excluded from all tool contexts.

## Code structure

The application is one Nuxt app. Pages in `app/pages/` coordinate state through composables in `app/composables/` and components in `app/components/`; templates stay declarative, with asynchronous work and multi-step mutations in named script functions. Nitro routes in `server/api/` are thin HTTP mappings; domain operations live in focused modules under `server/domain/`; database access stays in `server/database/` behind Drizzle. No generic repositories, service-forwarding layers or one-line wrapper classes.

Keep transaction boundaries explicit for publication/import. Use early returns, small named functions and explicit error paths. Do not swallow errors unless an optional fallback is intentional and visible. Add comments only when the reason cannot be expressed clearly in code; comments explain why, not syntax. Tests assert observable behavior and use isolated databases. Regression fixes need a reproduction test.

## Database changes

The complete schema lives in `server/database/schema.ts`. Use `npm run db:generate -- --name=topic`, inspect the generated SQL, then `npm run db:migrate`. Commit schema, SQL and Drizzle metadata together. Application startup applies checked-in migrations using Drizzle's official `migrate()`; production never generates migrations or runs `push`.

Never edit an applied migration or delete SQLite/WAL files to resolve a mismatch. Back up data before manual intervention. Only the checked-in Drizzle migration history is supported. Do not add compatibility adapters for unreleased development schemas.

## Plans and commits

Specifications and plans share a globally increasing four-digit ID, independent of topic alphabetization or date. Example: `0003-2026-11-02-tooling-design.md` and `0003-2026-11-02-tooling.md`. The date records authorship; the ID records order. Use `npm run docs:new -- topic-slug` to allocate the next pair. Keep an index under `docs/superpowers/` and update links when moving historical documents.

Finish each plan with verification and an English Conventional Commit, for example `feat: implement typed YAML package import` or `chore: standardize project tooling`. Do not leave completed plans uncommitted. Do not invent historical per-plan commits by rewriting already recorded history.

Before committing, run `npm run check`; add `npm run test:e2e` for UI changes. Record unavailable checks explicitly. Review the staged diff for secrets/data and unrelated files. No automatic push or branch creation is implied.

## Runtime and dependency policy

Node.js 24 LTS and npm are the supported local toolchain. `package-lock.json` is authoritative; use `npm ci`, not an unreviewed dependency refresh. The repository `.npmrc` sets `ignore-scripts=true`: every native dependency (better-sqlite3, esbuild, Biome) ships prebuilt binaries, and allowing scripts would make `npm ci` run an implicit `node-gyp rebuild` that demands a C++ toolchain. If a future dependency genuinely needs an install script, revisit that setting deliberately. Pin tooling that controls generated output. Dependency upgrades are explicit changes, not a side effect of formatting.

Both local and Compose workflows must remain usable. Do not make tests depend on a developer's `.env` or database. Compose keeps the `./db:/data/db` bind mount and HTTP-only Caddy; TLS remains external. Docker runtime checks must not be claimed when Docker is unavailable.
