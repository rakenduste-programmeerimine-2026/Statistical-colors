---
name: prepare-pr
description: Prepare a Pull Request for the current feature branch, including the required checks and reviews. Use when a unit of work is finished and ready for developer review.
---

# Prepare a Pull Request

Merging and approval are left to the developer and the team. Prepare the Pull Request, ask the user for permission to open it, and stop. Never approve a Pull Request, including your own.

## 1. Confirm the work

- The GitHub Issue for this work exists and its scope is complete.
- Commits follow the Angular convention, are bundled by logical type at about 50 to 150 changed lines each, and reference the issue.
- No backend or database code, or their tests, is committed unless the user explicitly allowed it (see Team scope in `CLAUDE.md`).
- Any `PLACEHOLDER(#issue)` has a matching backlog item.
- Every bug fixed on this branch is logged in `docs/bugs/README.md`, and any implicit state machine involved is documented in `docs/automata/`.
- Supabase changes such as migrations, seed data and `supabase/config.toml` are committed, with no secrets.

## 2. Run the checks

Run all of these and fix any failures:

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

Integration and database tests need local Supabase, and CI does not run them, so they must pass here. Also run database-related tests where applicable. Check that tests cover equivalence partitions and boundary values, including character length and similar constraints where useful.

## 3. Confirm the reviews

- Server code or compute-heavy code: the `performance-analyst` agent has run and its recommendation was followed.
- All code changes: run the `prompt-compliance-reviewer` agent. Fix any deviations, or report them to the developer.

## 4. Open the Pull Request

Push the feature branch. Show the user the title and body and ask for permission. Only after they agree, open the Pull Request against the integration branch, `integrationBranch` in `.claude/project.json`:

```bash
gh pr create --base <integration-branch> --title "<Angular-format title>" --body "<body>"
```

Use this body:

```markdown
Closes #<issue>

## Summary

## Tests and checks
- [ ] Automated tests
- [ ] Type checking
- [ ] Linting
- [ ] Production build
- [ ] Integration tests
- [ ] Database tests, if applicable

## Reviews
- Prompt compliance: <verdict>
- Performance analysis: <recommendation, or not applicable>

## Placeholders and known limitations
```

Tick only what actually passed. Report the Pull Request link and anything the developer needs to decide.
