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

## P-010 (2026-11-17): Slides and Lean model as informal reference

Type: instruction
Issue: #27

> there are slides and lean code in the claude setup now as informal reference what new understanding did they provide? run the lean code, remember to not commit them as they are only their findings and roadmaps etc

> update the roadmap and other places with the plan

## P-011 (2026-11-17): Decisions from P-010

Type: approved decision
Source: P-010
Issue: #27

1. `claude-setup/` (slides, `VisualMedia.lean`, `AUDIT.md`) is informal reference. It is never committed.
2. The plan from the slides is the roadmap, recorded in `docs/roadmap.md` and as GitHub issues.
3. Target: the colour tokens of a design and, later, which component uses which colour. Grids, spacing and type scales are out of scope.
4. Colours come in and go out as 8-bit sRGB (untagged means sRGB). The blend test runs in encoded sRGB. Clustering, distances and harmony run in OKLab/OKLCH with ΔE.
5. Results are reported as consistent with the input, never as proven to be the original.

[UNDERSTANDING] `VisualMedia.lean` type-checked with Lean 4.36.0 on 2026-11-17 (exit code 0, two deprecation warnings for `dif_pos`). This is a run on the developer's machine, not an independent audit. Axioms were not printed.

## P-012 (2026-11-17): Heavy technology review, library audit, rules for agents

Type: instruction
Issue: #36

> make sure not to add stuff like webgl without human review, run an audit before starting to write code for whether some library, package etc exists that allready does this very common cross domain task, keep it reasonable everything doesn't need one but for example image decoding should atleat warrent checking for existing things. Make sure this and other previous meta level claude instructions in prompts are saved and get to the other agents and their context as well

## P-013 (2026-11-17): Decisions from P-012

Type: approved decision
Source: P-012
Issue: #36

1. Heavy technologies such as WebGL, WebGPU, WebAssembly, native modules, Web Workers and worker threads need the user's review and explicit approval before they are added, in addition to the `performance-analyst` justification.
2. Before writing code for a common, cross-domain task (for example image decoding, colour space conversion, CSV, file upload, charts), run the `library-auditor` agent to check whether a maintained library already does it. Small, project-specific logic does not need an audit.
3. All standing meta rules for Claude live in the "Standing rules" section of `CLAUDE.md`. Every agent reads `CLAUDE.md` and `docs/prompts.md` before it starts.

[UNDERSTANDING] "Meta level instructions" means the rules about how Claude works rather than what the app does: P-002/P-003 (bugs, state machines, prompt commits), P-004/P-005 (integration branch, no approving PRs), P-007 (team scope), P-008/P-009 (no PR without permission, commit size), P-011 (`claude-setup/` never committed) and P-013.

## P-014 (2026-11-17): Note on earlier entries

Type: approved decision
Issue: #36

Clarification only; no earlier entry is rewritten.

1. P-001 to P-003 belong to issue #25. They were written before this repository's history began.
2. Q-2, Q-3 and Q-4, named in P-002 and P-003, were open questions in a version of this file that came before the repository. Their answers are recorded in P-003.
3. P-008 supersedes the "Prepare the Pull Request" workflow step in `CLAUDE.md`, not an entry in this file.

## P-015 (2026-11-17): One setup PR, no comments on others' Pull Requests

Type: instruction
Issue: #25

> roll all 3 into one, do not comment on others pull requests those are outside your scope

## P-016 (2026-11-17): Decisions from P-015

Type: approved decision
Source: P-015
Issue: #25

1. The work for #25, #27 and #36 ships as one Pull Request, #26.
2. Claude never comments on, reviews or otherwise acts on other people's Pull Requests. They are outside its scope. Findings about them go to the user only.

## P-017 (2026-11-17): Port the old Flask frontend to Next.js

Type: requirement
Issue: #37

> in claude setup folder there is now a folder called old code your goal is to take the frontend from it and convert it into nextjs, allign it with current issues, roadmaps, kanban boards do not add features not allready in the original code unless they are minor. Simulate the backend with generated tests/stubs assume the backend and database will be added and create issues for the features needed. As this is a major refactor build the thing first and wait for my goahead before turning it into chunks ready to be commited and later turned into a pull request, same goes for the issues.

> generate the issues, stage the commits, open a merge request etc

> remember roadmap and kanban board

## P-018 (2026-11-17): Decisions from P-017

Type: approved decision
Source: P-017
Issue: #37

1. One image per upload, as in the original. Multiple files and drag and drop stay in #15.
2. Saved themes live in the browser (localStorage) behind a `ThemeStore` port. No backend or database work for themes.
3. The backend is simulated in the frontend: an `AnalysisService` port, a stub adapter that returns clearly marked fake results, and contract tests the real adapter (#40) must pass. No Route Handlers or Server Actions.
4. Users type theme colours as hex. The browser converts them with `oklch(from <hex> l c h)`, so UI colours stay OKLCH.
5. The saved-themes dropdown uses `@radix-ui/react-select` (library audit; approved by the user).
6. TIFF is dropped from the allowed formats, because browsers cannot decode it.
7. Backend features the port needs: #38 (pixel-by-pixel CSV), #39 (read an analysis by id), #40 (real adapter).
8. For this task, issues, commits and the Pull Request waited for the user's go-ahead, which P-017's second quote gives.

## P-019 (2026-11-17): Exact pixel preview and a demo result

Type: requirement
Issue: #42

> add a exact pixel viewer like preview when a user adds a file currently have the results of a file being processed in the frontend as dummy data when someone presses the demo button and open the bmp included with it in the preview screen. Use an example from the previously uploaded statistical analysis of color pickers

## P-020 (2026-11-17): Decisions from P-019

Type: approved decision
Source: P-019, the user's answers to the conflict review
Issue: #42

1. The viewer and the demo are an explicit exception to P-017's "do not add features not allready in the original code". The viewer is ported from `claude-setup/old code/Exact Pixel Viewer (1).html`, without its own colour counting (the analysis service counts colours) and without paste or drag and drop (#15).
2. The demo image is `palette (1).bmp` from the old app's `uploads/` (`palette_1__1dab3c06aafd1d68`). It is copied into the repository with its colour summary and its original pixel CSV (user's answer: "BMP + summary + pixel CSV"). This is an approved exception to P-011: only these copies are committed, `claude-setup/` itself still is not.
3. The demo results are labelled as an example result from the earlier colour picker study (user's answer: "Mark as example"). It is permanent, not a placeholder.
4. The preview appears on the upload page for the picked file and on the demo results page (user's answer: "Upload + demo results"). `ImageAnalysis` gets an optional `imageUrl`, which the real adapter (#39, #40) may fill later.
5. The branch for #42 is stacked on `feat/37-flask-frontend-nextjs` until #41 merges (user's answer: "Stack on #37").
6. Library audit: platform `createImageBitmap` with `colorSpaceConversion: "none"` and `premultiplyAlpha: "none"`, plus canvas 2D. No dependency. If the browser rejects those options, the preview shows an error instead of an inexact decode.

## P-021 (2026-11-17): Claude's decisions while building #42

Type: decision, not yet confirmed by the user
Source: browser check, `performance-analyst` and `prompt-compliance-reviewer` runs for #42
Issue: #42

[UNDERSTANDING] These change the reference viewer's behaviour. They stand until the user says otherwise.

1. Plain scrolling over the preview scrolls the page; Ctrl (or Cmd) + scroll zooms. The reference viewer filled the window, so plain scrolling zoomed there; embedded in a page it trapped scrolling.
2. Until the user zooms or pans, the preview keeps fitting when its size changes. The first size the browser reports can be smaller than the final layout, which gave a too-small first fit.
3. The preview decodes images up to 4096 × 4096 pixels (`MAX_PREVIEW_PIXELS`, about 16.7 MP, the iOS Safari canvas limit) and explains when an image is larger. The analysis is not limited by this. Per `performance-analyst`: the main thread is fine, so no Worker or WebAssembly.
4. A new file releases the previous decoded image (`performance-analyst`: memory retention).
5. The upload page previews a file only after it passes the upload rules (type and 25 MB).
6. The demo CSVs and BMP are stored byte for byte (`public/demo/** -text` in `.gitattributes`). `src/adapters/demo/palette-analysis.json` is generated once from the original app's `palette_1__1dab3c06aafd1d68.json` and summary CSV.

## P-022 (2026-11-17): The screenshot plugin

Type: requirement
Issue: #44, #45, #46, #47

> commit it and open the pull request and begin staging the plugin screenshot tool

Answers to the clarifying questions: tool "Extension + Figma plugin"; scope "Capture + recovery approaches"; connection "Feed the analyser (Recommended)"; form "TypeScript, own folder (Recommended)"; debugger "Optional permission (Recommended)"; new tooling "Approve all (Recommended)".

> the screen capture is inseperable part of the minimal viable product the info gathered by the analysis here gets added as optional metadata for figma as the end deliverable

> analysis gets performed in the backend and was described on the slides, so the database, start up a new brach for plugin work, but it gets handled by the person and agents doing frontend

## P-023 (2026-11-17): Decisions from P-022

Type: approved decision
Source: P-022
Issue: #44, #45, #46, #47, #48

1. The Chrome extension (`feedback-shot/2-extension/`) and the Figma plugin (`feedback-shot/figma-plugin/`) are ported from the reference material to TypeScript, in `extension/` and `figma-plugin/`. They are rewritten, not copied, as with P-017. Assets are not copied verbatim. The `ontology/` tests and font fixture are out of scope for now.
2. Scope: the lossless capture (#44), all seven recovery approaches and their combinations (#45), the Figma plugin (#46), and opening captures in the analyser (#47). #47 and the Figma metadata are approved exceptions to P-017's "do not add features not allready in the original code".
3. The pipeline is the MVP (milestone M2): capture with the extension, analyse in the backend, store the result in the database, and build the Figma file with the analysis attached as optional metadata. The Figma file is the end deliverable. This replaces the roadmap's "This comes from outside the project (#35)".
4. Analysis runs in the backend and is stored in the database (team scope). The plugin reads it through #48 and runs without it until then (`PLACEHOLDER(#48)`).
5. Plugin and extension work is frontend work, done by the frontend developer and Claude. It lives on its own branch, `feat/44-screenshot-plugin`, started from `chore/25-claude-setup` (#26) so the Claude setup is present. It does not depend on the app-port branches (#41, #43).
6. The `debugger` permission is optional (`optional_permissions`) and requested only when K1, S1 or S3 is chosen. Plain capture uses `tabs.captureVisibleTab` without it.
7. Approved tooling (heavy-tech and dependency review): the MV3 background service worker, plain `tsc` builds with no bundler, and the type-only devDependencies `@types/chrome` and `@figma/plugin-typings`. Chrome APIs are tested with hand-written fakes. No browser-mode tests for now.
8. Per the library audit: the old hand-written PDF path reader, tracer and diff are kept, because no library fits exactly. [UNDERSTANDING] `parseColor` also falls back to the browser (a 1×1 canvas) for colours the regex does not read, such as `oklch()`.
9. OKLCH applies to the popup and plugin UI. Captured and rendered content stays 8-bit sRGB (P-011).

## P-024 (2026-11-17): Note on this branch's copy of this file

Type: approved decision (clarification only)
Source: P-023 item 5
Issue: #44

P-017 to P-021 (the app port, #37, and the pixel preview, #42) are recorded on those branches, which this branch does not contain. They join this file when those Pull Requests merge. P-023 refers to them by number.

## P-025 (2026-11-17): Claude's decisions for the recovery approaches

Type: decision, not yet confirmed by the user
Source: `performance-analyst` run for #45 (no heavy technology recommended)
Issue: #45

[UNDERSTANDING] These change the reference behaviour to keep runs inside Chrome's limits. They stand until the user says otherwise.

1. K1 limits its scale: the k× image stays within 16384 px per side and 64 MP. The scale halves from the chosen one until it fits; report.json records the requested and effective scale. At 8× on a 2× display, 1920 × 1080, the reference asked for about 531 MP, past Chrome's canvas limits.
2. K1 saves the PNG Chrome returned instead of decoding and encoding it again. D1 does not keep its black and white shots, which nothing reads.
3. D2 prepares each palette pair once and skips pairs a colour cannot reach. The skip is exact: a test checks that results equal the reference algorithm's.
4. F1, the patch step and the PDF reader get time and size limits: one time budget per call with checks inside the shape searches, a drawing area the size of the region being fitted, a cap on targets and patches, and no local quantising of regions the tracer would reject anyway.
5. The pipeline pings Chrome between steps, so the service worker is not stopped after 30 idle seconds.
6. S1's paint-record replay at k× is not ported. Chrome does not let extensions use the LayerTree domain, so the extension always uses the layout record.

## P-026 (2026-11-17): Limits added after the compliance review of #45

Type: decision, not yet confirmed by the user
Source: `prompt-compliance-reviewer` run for #45
Issue: #45

[UNDERSTANDING] Completes P-025 item 4, which the first version did not fully implement. Stands until the user says otherwise.

1. The PDF reader refuses files over 64 MB, keeps at most 100,000 paths, and stops after 30 seconds. When it stops early, the page says why (`truncated`).
2. The patch step stops scoring after 120 seconds as well as after 60 patches; the rest become bitmaps, and the report says which and why.
3. S1's report keeps the reference field `paintRecordUnavailable`, so report.json still says why there is no paint record.
4. Open question for the user: `extension/src/core/control-templates.ts` holds the reference's template data for Chrome's form-control art unchanged, because its generator needs a Chrome test setup that is not in this repository. P-023 item 1 says assets are not copied verbatim; whether this data counts as an asset is for the user to decide.

## P-027 (2026-11-17): The debugger permission is required, not optional

Type: approved decision
Source: the user's report from loading the extension, and their answer
Issue: #44

> Permission 'debugger' cannot be listed as optional. This permission will be omitted.

Answer: "Required, attach on demand (Recommended)".

1. Chrome does not allow `debugger` in `optional_permissions`, so P-023 item 6 cannot be done as written. This replaces it.
2. `debugger` is a normal permission, which Chrome shows once at install. The extension still attaches only while K1, S1 or S3 runs, so a plain capture never shows Chrome's debugging bar. The popup no longer asks for the permission.

## P-029 (2026-11-18): Plugin pull requests are stacked on the app port

Type: approved decision
Source: the user's answers on syncing the branches
Issue: #44, #46

> avoid the merge conflict

Answer: "Stack plugins on app (Recommended)".

1. The app-port branch (`feat/42-pixel-preview-demo`) is merged once into `feat/44-capture-extension`, which resolves the shared docs and tooling there. The pull requests form one line, #26 → #41 → #43 → #51 → #52, and merge in that order. This replaces P-023 item 5's independence from the app-port branches.
2. P-024 no longer applies: P-017 to P-021 are now in this branch's copy of this file.
