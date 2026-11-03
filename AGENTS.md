# Repository instructions

- Read `CONTRIBUTING.md` before implementation. Follow the numbered specification and plan for the task.
- Write identifiers, code comments, technical documentation and commit messages in English. Player-facing text and campaign content may remain Russian. Do not translate player-facing copy as a tooling change.
- Use Biome for supported source/configuration files, including Vue templates. Run `npm run format` after edits and `npm run check` before declaring a plan complete. Run browser tests for UI changes.
- Use the official Drizzle migrator and Drizzle Kit. Define the complete application schema in `server/database/schema.ts`; generate and review migrations. Never reset a database or rewrite an applied migration to make tests pass.
- Prefer the installed framework/library APIs over home-grown equivalents. Explain exceptions in the relevant plan.
- Keep Vue templates declarative. Move asynchronous work and multi-step mutations to named script functions; split pages by responsibility when formatting reveals oversized components.
- Use descriptive names, explicit domain contracts and strict TypeScript. Avoid `any`, implicit error swallowing and broad lint suppressions. Keep modules focused; avoid unrelated refactors.
- Number specifications and plans with one shared, globally increasing four-digit feature ID before the date: `NNNN-YYYY-MM-DD-topic[-design].md`. Use `npm run docs:new -- topic` for new pairs. Do not renumber existing IDs.
- Complete the plan, run its checks, record real verification and remaining limitations, then create an English Conventional Commit for that completed plan. The user has authorized this policy. Do not push, publish or create branches without a separate request.
- Never edit, import automatically or include `obsidian/` in Git/build contexts. Keep secrets, live SQLite files and test artifacts out of Git.
- Keep local development/testing independent of Docker. Preserve `db/` as the Compose bind mount; the root Compose setup serves HTTP directly on port 3000 (no reverse proxy in the deployment).
