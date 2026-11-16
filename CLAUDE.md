# Project rules

The primary goal is the smallest maintainable codebase: easy to understand, test, extend and maintain.

`docs/prompts.md` is the source of truth for requirements. If this file and `docs/prompts.md` disagree, follow `docs/prompts.md` and report the difference.

## Standing rules

These apply to the main session, every agent and every skill. Agents read this section and `docs/prompts.md` before they start.

1. **Requirements:** `docs/prompts.md` is the source of truth. Record every new requirement or decision there, quoted exactly. Never silently override an earlier one; ask first. (P-001, P-003)
2. **Pull Requests:** never open one without the user's permission. Never approve or merge one, including your own. (P-005, P-009)
3. **Branches:** never push directly to `main` or the integration branch (`develop-frontend`). (P-001, P-005)
4. **Commits:** bundle by logical type, about 50 to 150 changed lines each, Angular convention, linked to an issue. (P-009)
5. **Team scope:** do not change backend code, database code or their tests without explicit permission. Frontend, CI, tooling, docs and the Claude setup are fine. See Team scope. (P-007)
6. **Reference material:** never commit `claude-setup/`. (P-011)
7. **Heavy technology:** WebGL, WebGPU, WebAssembly, native modules, Web Workers, worker threads and parallel processing need a `performance-analyst` justification and the user's explicit approval before they are added. (P-013)
8. **Library audit:** before writing code for a common, cross-domain task (image decoding, colour space conversion, CSV, file upload, charts), run the `library-auditor` agent. Small, project-specific logic needs no audit. (P-013)
9. **Bugs:** follow the `fix-bug` skill and log every fix. Ask for the go-ahead before refactoring an implicit state machine, and document it either way. (P-003)

## Stack

Use the latest stable versions.

- Framework: Next.js (App Router), following Next.js conventions. There is no separate Express.js server.
- Backend: Next.js server code, meaning Route Handlers, Server Actions and Supabase data access.
- Use ports and adapters wherever they do not clash with Next.js, in both the frontend and the server code. If unsure, run the `frontend-architecture-reviewer` agent and follow its verdict.
- Language: TypeScript, including automated tests.
- Database: Supabase.
- UI colors: OKLCH only.
- Colour analysis: 8-bit sRGB in and out. The blend test runs in encoded sRGB; clustering, distances and harmony run in OKLab/OKLCH with ΔE. See `docs/roadmap.md`.

## Architecture

- Keep UI, server code and database independent, with clearly defined interfaces and responsibilities.
- Avoid unnecessary coupling between layers.
- Supabase runs only on the developer's own computer. All Supabase code still goes in GitHub: `supabase/config.toml`, migrations, seed data and database tests. Only running it and applying changes is local. Never commit `.env` files, keys or other secrets.
- If an integration or dependency is not available yet, use a dummy value, mark it in code with `PLACEHOLDER(#issue)`, and create the backlog item.
- If a new prompt cannot reasonably fit the established architecture or principles, ask for clarification and approval.

## Workflow for every prompt that changes code

0. **Integration branch.** If `integrationBranch` in `.claude/project.json` is empty, ask the user which branch it is before anything else (suggest `develop`). Record the answer there and as an approved decision in `docs/prompts.md`, and remove Q-1 from its open questions.
1. **Check for conflicts.** Run the `prompt-conflict-reviewer` agent before changing code. If it finds a conflict, explain it and get explicit confirmation before implementing. Never silently override an earlier requirement.
2. **Create the GitHub Issue automatically** with `gh issue create`, without asking, then create a feature branch for it from the integration branch.
3. **Record the prompt.** After the issue exists, update `docs/prompts.md` with new requirements, approved decisions and clarified architectural choices. Commit only that file, on the current feature branch, and push right away without being asked.
4. **Audit libraries.** Before code for a common, cross-domain task, run the `library-auditor` agent. Ask the user about anything it flags.
5. **Analyze performance.** Before new server code or compute-heavy code, such as image decoding or color counting, run the `performance-analyst` agent.
6. **Implement and test.** Testing is part of development, not a final step.
7. **Check compliance.** After code changes, run the `prompt-compliance-reviewer` agent and report any deviations.
8. **Prepare the Pull Request** with the `prepare-pr` skill. Ask the user before opening it. Merging is left to the developer.

## Bugs

Whenever you fix a bug, follow the `fix-bug` skill and log the bug type, a short description and what fixed it in `docs/bugs/README.md`.

If the bug comes from an implicit state machine:

- Run the `state-machine-analyst` agent to decide whether it should be made explicit in code and refactored.
- Ask the user for the go-ahead before any such refactor.
- Document the state machine in `docs/automata/` either way, even if it stays implicit.

Document every implicit state machine you find, not only ones that caused a bug.

## Git

- Never push directly to `main` or the integration branch. Never merge Pull Requests.
- Use a feature branch for all development work.
- Integration branch: `integrationBranch` in `.claude/project.json` (`develop-frontend`).
- Commit messages follow the Angular convention: `type(scope): subject`, with `Refs #123` or `Closes #123` in the footer.
- Commit size and Pull Request permission: see Standing rules 2 and 4. A single file larger than 150 lines may be one commit.
- Development, integration, release preparation and production deployment are distinct stages. Use the `release` skill for releases.

## Team scope

This is a team project, and teammates own the backend and the database.

- Allowed without asking: frontend code (pages, components, styles, client-side logic) and its tests, CI, tooling, documentation and the Claude setup.
- Not allowed without the user's explicit permission: backend code (Route Handlers, Server Actions, Supabase clients and data access), database code (`supabase/`, migrations, policies, seed data) and the tests for either.
- If frontend work needs a backend or database change, describe what is needed in the issue or Pull Request and leave it to the team.

## Database and production

- Manage schema changes through version-controlled migrations.
- Verify migrations before they are applied to production.
- Never make undocumented direct changes to production.

## Testing

- A change is not complete merely because it compiles.
- Before merging or releasing, run automated tests, type checking, linting, the production build, relevant integration tests, and database tests where applicable.
- Integration and database tests need local Supabase, so run them locally before every Pull Request. CI runs the rest on every push.
- Use equivalence partitioning and boundary-value analysis, including character length and similar constraints where useful.

## Performance

Prefer simple TypeScript implementations and existing platform APIs. Heavy technology needs a `performance-analyst` justification and the user's approval (Standing rule 7).

## Planning and documentation

- The roadmap is `docs/roadmap.md`. Keep it in step with the issues and milestones.
- `claude-setup/` holds informal reference: slides, the Lean model and its audit (Standing rule 6).
- Every significant development task has an issue. Keep the backlog, timeline and Kanban board synchronized with the `project-planning` skill.
- Document systems as finite automata where possible, with the `finite-automata` skill. User stories built from them go in `docs/user-stories.md`.
- Aggressively separate documented system behaviour, at any level of abstraction, into independent audit, quoted prompt, and your own understanding.
- Do not leave unfinished integrations or dependencies undocumented. Anything that must be created, configured or connected outside this project goes in all relevant planning structures.
