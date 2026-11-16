# Prompts

Source of truth for development requirements: original requirements, later instructions, and approved decisions.

Rules:

- Add new entries at the end, with the next `P-###` ID. Never rewrite an earlier entry.
- If a new entry changes an earlier one, name the entry it supersedes.
- Quote prompts exactly. Keep your own understanding out of quoted text.
- Commit changes to this file on their own and push them right away.

Entry format:

```markdown
## P-### (YYYY-MM-DD): <title>

Type: requirement | instruction | approved decision
Issue: #<number>
Supersedes: <entry ID, if any>

<exact prompt text or decision>
```

## Open questions

These need the developer's decision. Until then, the working assumption applies. Record each answer as an approved decision and remove it from this list.

| ID | Question | Working assumption [UNDERSTANDING] |
|---|---|---|

## P-001 (2026-11-05): Project Development Standards & Workflow

Type: requirement

Project Development Standards & Workflow
1. Core Technology Stack
Use the latest stable versions of the following technologies:
Frontend: Next.js
Backend: Node.js with Express.js
Backend architecture: Ports and Adapters (Hexagonal Architecture)
Language: TypeScript
Database: Supabase
Always prefer Next.js conventions for frontend development. Where ports and adapters or functional programming principles can reasonably be applied to other parts of the frontend, without fighting the language or introducing unnecessary complexity.
The primary objective is to produce the smallest maintainable codebase possible: easy to understand, test, extend, and maintain.
Use OKLCH exclusively for frontend user-interface color definitions.
2. Project Architecture and Separation
Keep the following areas as independent and decoupled as reasonably possible:
Frontend
Backend
Database
Each area should be developed and maintained independently, with clearly defined interfaces and responsibilities.
Avoid unnecessary coupling between application layers.
Supabase must run locally during development. Local Supabase should be used exclusively on the developer's own computer.
When integrations or external dependencies are not yet available, use dummy values where necessary. Clearly document these placeholders and create corresponding backlog items to ensure they are implemented and connected in the appropriate environment later.
3. Git and Version Control Conventions
Follow the Angular Git commit message convention.
Use feature branching for all development work.
Never push directly to main.
The required development workflow is:
Create a GitHub Issue before starting a new unit of work.
Create a feature branch associated with that issue.
Implement the requested functionality.
Reference the relevant issue in commits and pull requests.
Run the required tests and checks.
Open a Pull Request targeting the appropriate integration branch.
Merge only after all required checks and reviews pass.
Keep commits doing one thing, logically scoped, and traceable to issues.

Follow a controlled release process. Development, integration, release preparation, and production deployment must be distinct stages.
Pull Requests and Integration
Leave merging to the developer but prepare the requests:
Complete the relevant GitHub Issue.
Satisfy all testing and quality assurance requirements defined in Section 6.
Complete prompt-compliance verification as defined in Section 7.
Complete relevant performance analysis for backend changes as defined in Section 5.
Open a Pull Request targeting the appropriate integration branch.
Require successful CI checks and appropriate review.
Use Semantic Versioning:
MAJOR: Breaking changes.
MINOR: Backward-compatible functionality.
PATCH: Backward-compatible bug fixes.
Before creating a release:
Verify that all intended issues are completed.
Confirm that relevant tests and CI checks pass.
Verify database migration requirements.
Verify environment configuration.
Prepare release notes.
Identify known issues and outstanding limitations.
Tag the exact commit being released.
Create a GitHub Release for every official release.
Release notes should include completed features, resolved issues, bug fixes, breaking changes, migrations, and relevant deployment instructions.
Plan releases around previously established milestones.
Manage database schema changes through version-controlled migrations.
Verify migrations before applying them to production.
Never commit production credentials or secrets to GitHub.
Never make undocumented direct changes to production.
When a new prompt cannot reasonably be accommodated within the established architecture or development principles, request clarification and approval.
4. Project Planning and Management
Maintain the following project management structures:
Project backlog
Timeline board
Kanban board
Milestones
Releases
Plan milestones in advance and organize development work into logical, achievable stages.
Every significant development task should be represented by an issue.
Organize issues in a logical development order, taking dependencies and architectural requirements into account.
Keep the backlog, timeline, and Kanban board synchronized.
Use finite automata to document systems where possible, building corresponding user stories based on them into a separate file.
Separate documented system behaviour according to:
Independent audit.
Quoted prompt.
Your own understanding.
Apply this separation at any level of abstraction. Be aggressive in identifying and documenting these distinctions.
If a task requires something to be created, configured, or connected outside the current project, explicitly document it in all relevant planning structures.
Do not silently leave unfinished integrations or dependencies undocumented.
5. Development and Performance Analysis
Before introducing new backend functionality or making significant backend changes, conduct a performance analysis using a separate agent.
The analysis should consider:
Expected computational complexity.
Memory consumption.
CPU utilization.
Potential performance bottlenecks.
Node.js performance characteristics.
Whether native C++ implementation through Node.js capabilities would provide a meaningful benefit.
Whether parallel execution across multiple CPU cores could improve performance.
Whether multithreading or worker threads would provide measurable benefits.
The additional complexity and maintenance costs of each optimization.
If a component is computationally intensive or performance-critical, consider implementing that specific component in C++ where justified.
Do not introduce C++, multithreading, worker threads, or parallel processing without a reasoned performance justification.
Prefer simple Node.js implementations unless analysis demonstrates a meaningful benefit from a more complex approach.
6. Testing and Quality Assurance
Write automated tests in TypeScript.
Testing must be an integral part of development, not an optional final step.
Before merging changes, run all relevant checks, including:
Automated tests.
Type checking.
Linting.
Production builds.
Relevant integration tests.
Database-related tests where applicable.
Equivalence partitioning and boundary-value analysis, including character length and similar constraints where useful.
Every push must be verified by the required tests and checks.
Never consider a change complete merely because the code compiles.
All testing and quality assurance requirements defined in this section must be satisfied before merging or releasing changes.
7. Prompt Management and Compliance
Maintain a dedicated prompts file containing the project's original requirements, subsequent instructions, and approved decisions.
This file serves as the project's source of truth for development requirements.
Push prompt changes separately each time, doing so automatically.
Before making code changes
Use a separate agent to:
Review the new prompt.
Compare it against all existing requirements in the prompts file.
Identify conflicts, contradictions, ambiguities, or architectural inconsistencies.
Determine whether the requested changes can be implemented without violating previous decisions.
If the new prompt conflicts with an existing requirement, clearly explain the conflict and request explicit confirmation before implementing the conflicting change.
Do not silently override previous requirements.
After making code changes
Whenever a prompt has resulted in code modifications, use a separate agent to:
Review the resulting changes.
Compare the current application against all previous requirements in the prompts file.
Identify any regressions or violations of earlier prompts.
Verify that architectural and development conventions remain intact.
Report any deviations.
Update the prompts file when necessary to reflect approved decisions, new requirements, and clarified architectural choices.

## P-002 (2026-11-14): Answers to open questions, bugs and implicit state machines

Type: instruction

> ask question 1 on setup when the user enters the first prompt. use ports and adapters in the frontend if it doesn't clash with nextjs if unusure use independent agent. 3 assumed a separate commit on the current feature branch, after the issue exists, create the issue automatically. 4 while the supabase should stay local all the code and changes should still be put into github just what the changes do should be local. When you encounter a bug and fix it add the type and a short description to a readme file and what you used to fix it in the case of a implicit state machine bug run a independent agent analysis to make sure that the implicit state machine shouldn't be made explicit in the code itself and refactored ask user for the go ahead before such a refactor, document all such implicit state machines even if they aren't made explicit

[UNDERSTANDING] "question 1", "3" and "4" refer to Q-1, Q-3 and Q-4. The ports and adapters sentence answers Q-2.

## P-003 (2026-11-14): Decisions from P-002

Type: approved decision
Source: P-002
Supersedes: the working assumptions for Q-2, Q-3 and Q-4

1. Q-1: Claude asks for the integration branch when the user enters the first prompt, and records it in `.claude/project.json`.
2. Q-2: Use ports and adapters in the frontend wherever they do not clash with Next.js. If unsure, an independent agent (`frontend-architecture-reviewer`) decides.
3. Q-3: Prompt changes go in a separate commit on the current feature branch, after the issue exists. Claude creates the issue automatically.
4. Q-4: Supabase stays local. All Supabase code and changes still go in GitHub; only running them and applying the changes is local.
5. Every fixed bug is logged in `docs/bugs/README.md` with its type, a short description and what was used to fix it.
6. For a bug caused by an implicit state machine, an independent agent (`state-machine-analyst`) analyzes whether it should be made explicit in code and refactored. Claude asks the user for the go-ahead before any such refactor.
7. Every implicit state machine is documented in `docs/automata/`, even if it is not made explicit.

## P-004 (2026-11-16): Commit size, Pull Request approval and frontend-only commits

Type: instruction
Issue: #25

> read through claude setup try to keep commits shorts and pertaining to one notable small subfunction per commit, never approve your own pull requests save these  commands to memory. Read through the folder claude setup implement what's in it and add what's nessassary from the previous sentence to it

> use develop but with a better name as you are working in a team, keep in mind you can only commit frontend code without explicit permission add that as well to claude setup and use it when choosing a name

[UNDERSTANDING] The second quote answers Q-1. "a better name" means a name that shows this integration branch is for frontend work, so it does not read as the whole team's `develop`.

## P-005 (2026-11-16): Decisions from P-004

Type: approved decision
Source: P-004
Issue: #25
Supersedes: Q-1

1. Q-1: The integration branch is `develop-frontend`, recorded in `.claude/project.json`.
2. Keep commits short. Each commit covers one notable, small subfunction.
3. Claude never approves its own Pull Requests. The `guard-git` hook blocks `gh pr review --approve`.
4. Claude commits only frontend code without the user's explicit permission. Backend, database, CI and tooling changes need explicit permission first.

## P-006 (2026-11-17): Next.js and Supabase stack, commit scope

Type: instruction
Issue: #25

> use nextjs and supabase fix claude steup, CI and tooling etc is fine just don't touch backend and database and their tests yourself.

## P-007 (2026-11-17): Decisions from P-006

Type: approved decision
Source: P-006
Issue: #25
Supersedes: P-001 "Backend: Node.js with Express.js" and "Backend architecture: Ports and Adapters (Hexagonal Architecture)"; P-005 item 4

1. The stack is Next.js and Supabase. There is no separate Express.js server. Server-side code lives in Next.js Route Handlers and Server Actions.
2. Ports and adapters apply wherever they do not clash with Next.js, on the server side as well as in the frontend (P-003 item 2).
3. Without explicit permission, Claude may commit frontend code, CI, tooling, documentation and the Claude setup. Claude does not change backend code, database code (Supabase migrations, policies, seed data, `supabase/`) or their tests.

[UNDERSTANDING] "Backend" means server-side logic: Route Handlers, Server Actions, Supabase clients and data access, matching the `backend` label on GitHub issues.

## P-008 (2026-11-17): Pull Request permission and commit size

Type: instruction
Issue: #25
Supersedes: P-005 item 2; the "Prepare the Pull Request" step's opening of the Pull Request without asking

> do not open pull request without permission, bundle the commits a bit more by logical type somewhere arournd fithy to 150 lines redo current commits

## P-009 (2026-11-17): Decisions from P-008

Type: approved decision
Source: P-008
Issue: #25

1. Claude does not open a Pull Request without the user's permission. It prepares the branch and the description, then asks.
2. Bundle commits by logical type, aiming for about 50 to 150 changed lines each. A single file larger than that may be one commit.
