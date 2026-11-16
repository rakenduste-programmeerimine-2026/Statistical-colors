# Project rules

The primary goal is the smallest maintainable codebase: easy to understand, test, extend and maintain.

`docs/prompts.md` is the source of truth for requirements. If this file and `docs/prompts.md` disagree, follow `docs/prompts.md` and report the difference.

## Stack

Use the latest stable versions.

- Framework: Next.js (App Router), following Next.js conventions. There is no separate Express.js server.
- Backend: Next.js server code, meaning Route Handlers, Server Actions and Supabase data access.
- Use ports and adapters wherever they do not clash with Next.js, in both the frontend and the server code. If unsure, run the `frontend-architecture-reviewer` agent and follow its verdict.
- Language: TypeScript, including automated tests.
- Database: Supabase.
- UI colors: OKLCH only.

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
4. **Analyze performance.** Before new server code or compute-heavy code, such as image decoding or color counting, run the `performance-analyst` agent.
5. **Implement and test.** Testing is part of development, not a final step.
6. **Check compliance.** After code changes, run the `prompt-compliance-reviewer` agent and report any deviations.
7. **Prepare the Pull Request** with the `prepare-pr` skill. Ask the user before opening it. Merging is left to the developer.

## Bugs

Whenever you fix a bug, follow the `fix-bug` skill and log the bug type, a short description and what fixed it in `docs/bugs/README.md`.

If the bug comes from an implicit state machine:

- Run the `state-machine-analyst` agent to decide whether it should be made explicit in code and refactored.
- Ask the user for the go-ahead before any such refactor.
- Document the state machine in `docs/automata/` either way, even if it stays implicit.

Document every implicit state machine you find, not only ones that caused a bug.

## Git

- Never push directly to `main` or the integration branch. Never merge Pull Requests.
- Never approve Pull Requests, including your own. Approval is left to another team member.
- Use a feature branch for all development work.
- Integration branch: `integrationBranch` in `.claude/project.json` (`develop-frontend`).
- Commit messages follow the Angular convention: `type(scope): subject`, with `Refs #123` or `Closes #123` in the footer.
- Bundle commits by logical type, aiming for about 50 to 150 changed lines each. Each commit is logically scoped and traces to an issue. A single file larger than that may be one commit.
- Never open a Pull Request without the user's permission.
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

Prefer simple TypeScript implementations. Do not introduce WebAssembly, native modules, Web Workers, worker threads or parallel processing without a reasoned performance justification from the `performance-analyst` agent.

## Planning and documentation

- Every significant development task has an issue. Keep the backlog, timeline and Kanban board synchronized with the `project-planning` skill.
- Document systems as finite automata where possible, with the `finite-automata` skill. User stories built from them go in `docs/user-stories.md`.
- Aggressively separate documented system behaviour, at any level of abstraction, into independent audit, quoted prompt, and your own understanding.
- Do not leave unfinished integrations or dependencies undocumented. Anything that must be created, configured or connected outside this project goes in all relevant planning structures.
