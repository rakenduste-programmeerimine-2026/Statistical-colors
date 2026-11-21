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

## P-028 (2026-11-17): Decisions while porting the Figma plugin

Type: decision, not yet confirmed by the user
Source: the library audit for #44 to #46 and Claude's port of #46
Issue: #46

[UNDERSTANDING] Stands until the user says otherwise.

1. Figma loads the plugin as one plain script plus one HTML page. `figma-plugin/build.mjs` compiles with `tsc` and joins the modules itself, with no bundler, as the library audit suggested.
2. The pure decisions (fonts, paints, gradients, borders, checks, report) live in `src/logic.ts` with unit tests. `src/code.ts` uses the Figma API, and `src/ui.ts` handles files and pixels in the plugin's window.
3. The colour analysis is attached to the imported frame as plugin data under the key `fs-analysis`, and the report layer says whether it was attached. Until the backend read exists (#48), the UI sends none (`PLACEHOLDER(#48)`), and the manifest allows no network access.
4. The plugin is named "Värvi tükeldaja · Intent Capture Import", with the id `statistical-colors-intent-import`.

## P-029 (2026-11-18): Plugin pull requests are stacked on the app port

Type: approved decision
Source: the user's answers on syncing the branches
Issue: #44, #46

> avoid the merge conflict

Answer: "Stack plugins on app (Recommended)".

1. The app-port branch (`feat/42-pixel-preview-demo`) is merged once into `feat/44-capture-extension`, which resolves the shared docs and tooling there. The pull requests form one line, #26 → #41 → #43 → #51 → #52, and merge in that order. This replaces P-023 item 5's independence from the app-port branches.
2. P-024 no longer applies: P-017 to P-021 are now in this branch's copy of this file.

## P-030 (2026-11-18): OKLCH readouts, colour structures, findings and a colour ontology

Type: requirement
Issue: #54

> add oklch into the ui as information for the user in places where now hex and rgb values have been displayed as text. begin adding features from the slides that could be represented in the frontend visually eg the color harmonies remember to use oklch exlusively there and assume the server sends the results. from here on out use planning mode in this prompt: Build out a detailed ontology of what else could be in the picture that cant be represented using the harmonies, and different cases where the color harmonies could be present eg teal and orange lighting in a photograph, a hsl based attempt at some color harmony etc be increadably thorough and wide in bredth use different fields agressively the end result should be stubs for backend and issues for backend and other such documentation and a frontend that can support it. The information should atleast cover all figma color features and tokens but aditional meta info about recovered colors is great as well. if you are unsure that something could be built try it in a folder that won't be commited even if it includes backend calculations.

Feedback on the first plan:

> No hdr or wider color spaces stick to srgb, when detecting color harmonies inn other colorspaces eg hsv, hsl add an option of showing them on the color wheel in their original colorwheel, but default view is oklch and on hover they can choose other colomodels to see how it would be placed there. Display the delta E from the ideal oklch harmony visually by increasing the size of the empty circle on the wheel backend sends delta E for each harmony point seperately along side its code and meta info about what harmony it is. Allow for multible per image. Remember to support more than just hormonies eg that this is a gradiant of colors with a same lightness where every color is some delta E apart from other colors map the possibility space thoroughly and mathamatically, also detect stuff like this is a ui with dark mode but keep it to stuff that can be detected reasonably and reliably without machine learning for now based on the pictures or with the extra information from screenshot tools.

On the experiments:

> Share the results of your experiments as a summary with others and for successful ones share the code clearly marked and asking for verification and tests on their side before it gets integrated to backend code

## P-031 (2026-11-18): Decisions from P-030

Type: approved decision
Source: P-030 and the user's answers
Issue: #54

1. The server computes the colour analysis: blend snap (#29), share filter (#30), clustering and tokens (#31), harmony and other structures (#33), and WCAG contrast (#34) are backend work. The frontend only displays results through the `AnalysisService` port. Only the sRGB → OKLCH conversion for live readouts (#28) is frontend code. This replaces the roadmap's unconfirmed reading that these steps run in the browser.
2. OKLCH text is added next to the existing hex and rgb text, which stays. Table swatches stay `rgb()` (P-011); the new panels use OKLCH only.
3. The UI this round: OKLCH readouts, a colour-structure wheel and list, and a generic findings panel that renders any kind the server sends.
4. The structure wheel defaults to OKLCH. On hover or focus the user can switch to the HSL, HSV, HWB or RYB wheel; a structure detected in another model is marked on its original wheel. The server sends several structures per image, each with a code, meta information and, per point, the ΔE to the ideal OKLCH structure, drawn as an empty circle that grows with ΔE.
5. Beyond harmonies, the ontology maps the space of colour structures mathematically (axis and path laws in OKLCH and OKLab), and covers UI structure such as dark mode, but only what can be detected reliably without machine learning, from the pixels or the screenshot tools' extra data.
6. Everything stays in 8-bit sRGB: no HDR, Display P3 or other wide spaces. An input tagged Display P3 (an image profile or a Figma document) is read as sRGB, and a finding says the source was tagged P3.
7. The ontology lives in `docs/ontology/` and as a typed schema in `src/core/analysis/`; the backend contract is `docs/api/color-analysis.md`.
8. "Stubs for backend" means the frontend stub adapter, `PLACEHOLDER(#issue)` markers, the API contract and backend issues. No Route Handlers or other server code in this repository.
9. P-017's limit ("do not add features not allready in the original code") applied to the port (#37) and no longer limits new work.
10. Experiments run in `claude-setup/experiments/` (not committed). Their results are shared as a summary, and the code of the successful ones is shared in a committed folder clearly marked as an unverified prototype, asking the backend team to verify and test it before it is integrated into backend code. The demo keeps the study data, and its colour analysis is simulated and labelled as such.
11. Library audit: the conversions are written by hand (CSS Color 4 matrices, about 100 lines); no library covers the required format or the RYB wheel. [AUDIT: experiment E1] Text `oklch(L% C h)` with 2, 5 and 2 decimals round-trips all 16,777,216 8-bit sRGB colours exactly; greys print the hue as `none`.
12. [UNDERSTANDING] No `performance-analyst` run: the frontend converts at most a few thousand colours per page plus one per pointer move, which is microseconds of arithmetic.

## P-032 (2026-11-18): Harmony lightness, artefact chance and equivalence-class filters

Type: requirement
Source: user prompt
Issue: #70 (frontend), #69 (backend)

> use oklch to determine the lightness level of the colors in the color harmonies and change the wheel to be the median lightness of the colors use the outer thickness of the ring around the color point to indicate the difference visually the thicker the lighter it is perceptually compared to the lowest perceptual brightness color use oklch even on the other color wheels for the median calculation and the brightness delta. show the chance of segupikslid, artefacts in the 5000 colors thinghy, add filtering by equivalance class eg if there are are rough percentage clusters allow to filter by them not just the 5000 most common

## P-033 (2026-11-18): Decisions from P-032

Type: approved decision
Source: P-032, the conflict review and the user's answers
Issue: #70, #69

1. The per-colour blend (segupiksel) and artefact chance is sent by the server (P-031 item 1 stays): `ColorCount.artefacts` with a registry kind and a chance 0–1 (#69, #29, #63). The stub and the demo simulate it and label it simulated; the demo's study counts stay unchanged.
2. The table filters by both share bands (rough percentage clusters: gaps in the log share) and the server's colour clusters (`ColorCount.clusterId`, simulated until #69), plus a blend/artefact filter. Filters combine.
3. Filters run over every colour the analysis holds, not only the top N, and show up to N matches. #69 asks the server to return all colours or to answer filter queries.
4. Every model's wheel (OKLCH, HSL, HSV, HWB, RYB) is drawn at the median OKLCH lightness of the harmony's actual colours; each model keeps its own hue order. A new ring around each filled colour dot thickens with that colour's OKLCH lightness above the darkest colour of the harmony. The ΔE circles are unchanged.
5. [UNDERSTANDING] The ring chroma at the median lightness is the largest constant chroma inside sRGB for every hue at that lightness (0.127 at L 0.75, experiment E2); other models' ring colours keep their OKLCH hue and are clipped into sRGB.
6. [UNDERSTANDING] Share bands split the sorted log10 shares at gaps of at least 0.5 decades, into at most 6 bands; with no such gap they fall back to decade bands. This is presentation arithmetic on numbers the server sent, not clustering.
7. [UNDERSTANDING] No library audit (project-specific display logic) and no `performance-analyst` run (sorting and filtering at most a few thousand rows in memory; rendering stays capped at N rows). The gamut clamp `clampChroma` (12 lines, a binary search on chroma using the existing hand-written conversion) extends P-031 item 11: a library would duplicate the conversion it already replaces.
8. [UNDERSTANDING] Chosen thresholds, open to change: lightness ring 1 px plus 30 px per unit ΔL, at most 16 px; a colour counts as a likely artefact at a chance of 0.5 or more; a row with an empty `artefacts` list counts as having no value.

## P-034 (2026-11-18): Colour of the ΔE circle

Type: requirement
Source: user prompt
Issue: #70

> use a color between the lightnesses of the background and the lightness circle for the circle representing how far the delta is from the ideal harmony

Decisions:
1. This replaces the clause "The ΔE circles are unchanged." in P-033 item 4, for the stroke colour only; the circle stays empty and its radius still grows with ΔE (P-031 item 4).
2. [UNDERSTANDING] "Background" is the page background (`--color-page`) and the "lightness circle" is the lightness ring around each colour dot (`--color-ink`). The new token `--color-delta` is `color-mix(in oklch, var(--color-ink) 50%, var(--color-page))`, so it follows the user's theme. Like `--color-muted`, it is an OKLCH mix of OKLCH theme colours, which fits P-001. The 50 % point is a chosen value, open to change.
3. [UNDERSTANDING] The line from the ideal point to the actual colour is unchanged.
4. [UNDERSTANDING] With the default themes the circle keeps about 3.4–4:1 contrast against the page and the core; a user theme whose text and background are close in lightness can push it below the WCAG 1.4.11 non-text 3:1. The ΔE values remain in the points table and the description.

## P-035 (2026-11-18): 3D colour-space view from the visualisation notebook

Type: requirement
Source: user prompt and answers
Issue: #75 (frontend), #74 (backend)

> there is visualisatsioonid code now in the old code folder the goal is to find the most advanced suitable version of it with minimal extra features eg cam16 is overkill and refactor it for this project step one is feature parity and step 2 is taking the colors as broken down in the backend and visually showing their distribution in 3d space and allowing the user to move around the camera in open space while sticking to nextjs and its ecosystem. The idea is to show visually how much of the whole the pixels cover. do not begin commiting before the end result has been approved by me if nessassary use backend code for testing that isn't put on github following the principles from before in tests

Answers:
- Renderer: "use canvas 2D as suggested and make sure the points that will be rendered as possibilities are perceptually distributed and the picture colors snap to them and color them in. change the plan for assotiated stages accordingly"
- Space: both OKLab and CIELAB, switchable.
- Coverage: the server sends it; the stub simulates it.
- Commits: hold everything (prompt record, issues, commits) until the user approves the result. The user approved it on 2026-11-18: "you have approval to proceed".

## P-036 (2026-11-18): Decisions from P-035

Type: approved decision
Source: P-035, the reviews and the user's answers
Issue: #75, #74

1. The base is the notebook's cell 19, the sampled sRGB gamut browser. Cells 0–15 (spectral object-colour solid), 17–18 (bit depth, luminance, JND) and 20 (CAM16) are left out: they go beyond sRGB (P-031 item 6) or add analysers.
2. Step 1 keeps cell 19's features: the in-gamut cloud, hue centre and width, chroma minimum and maximum, include neutrals, the counts, the hover readout, the 15,000 / 12,000 point caps, and refusing a chroma minimum above the maximum. The notebook's CIELAB default selection (hue 270, width 30, chroma 40–80) is kept; OKLab uses chroma 0.1–0.2.
3. Step 2: the possible colours are a cubic lattice with one step on every axis, so they are evenly spread by perceived difference: OKLab 0.02 ΔE_OK (6,789 points) and CIELAB ΔE*ab 4 (13,000 points) [AUDIT: experiment E10]. Each image colour snaps to its nearest in-gamut lattice point, which is coloured in and sized by the summed pixel share.
4. Rendering is Canvas 2D on the main thread: no WebGL, no Web Worker, no new packages [AUDIT: performance-analyst, library-auditor].
5. The camera orbits around the gamut centre or flies freely (W A S D or arrows, Q and E, drag to look); keys work while the view has focus.
6. The server sends the coverage as `colorAnalysis.gamut` (#74), computed on the OKLab lattice. The stub and the demo compute it the same way and mark it simulated.
7. [UNDERSTANDING] About 5 % of colours lie at the sRGB edge, where the nearest grid point is outside the gamut; they snap to the nearest point inside, at most 1.3 steps (OKLab) or 2.1 steps (CIELAB) away [AUDIT: experiment E10].
8. [UNDERSTANDING] The view keeps true proportions (one unit is the same length on every axis), unlike the notebook's cube aspect, so OKLab looks tall and CIELAB wide.
9. [UNDERSTANDING] CIELAB D50 conversions are hand-written from cell 19's constants (Bradford adaptation, rational sRGB matrices), extending P-031 item 11.

## P-037 (2026-11-18): Background colour of the 3D view and the pixel viewer

Type: requirement
Source: user prompt
Issue: #75

> allow to change the background color of the 3d pointcloud and the picture viewer thingy, explain what the backend sends to the frontend for the pointcloud and what determines the size of the gray circles in the color harmony wheel that say ideal on hover

Decisions:
1. The 3D view and the exact pixel viewer each get a background control: presets, any colour, or the default (the page background, and the reference viewer's stage colour). The chosen hex is converted with `oklch(from <hex> l c h)` (P-018 item 4) and applies only to that view, not to `--color-page`.
2. [UNDERSTANDING] On a background with OKLCH lightness below 0.6 the 3D view's text, rings and faint lattice switch to light colours.
3. [UNDERSTANDING] The choice resets on reload; it is not part of the saved theme.
4. [UNDERSTANDING] Chosen values of the ΔE circles (explained to the user): radius = base + 300 px × ΔE, at most base + 21 px (reached at ΔE 0.07), where base is the largest colour dot with its lightness ring on that wheel plus 3 px.

## P-038 (2026-11-21): User-test feedback, colour names, theme widget, and Lean verification

Type: requirement
Source: user prompt
Issue: #90, #91, #92 (frontend and docs), #93–#96 (backend)

> Värvide arvu muutmisel näitab rakendus ikka 5000 värvi. Zoomimine sülearvutitel on liiga järsk. Filtreerimine teeb brauseri aeglaseks, sest töötlus käib front-endis determine which would be faster.
> The chance of being a artefact percentage bar element jääb teiste elementide peale tabeli vaates. Salvestatud teemadele ei saa nime panna currently allow user set names and in general every place where a color code is add a label use npm color-name-list. Praegu on näha ainult värvikoodid, mistõttu on mitme teema seast õiget raske leida. Teema valiku asi ei liigu minimeeritud kujul kaasa paremal servas widgetina, seega peab üles ja alla kerima. Pildi üleslaadimise kast/nupp jääb raskesti märgatavaks. Pilditöötluse info on „debuggeri tasemel“, võtab palju ruumi ja on raskesti loetav. Seda ei saa kokku voltida, visuaalne hierarhia on nõrk ja näiteks väärtus „000“ ei ütle kasutajale midagi. Terminitele on vaja tööriistavihjeid (tooltip'e), sest kasutaja ei tunne värviteadust. Digitaalsete artefaktide tuvastus jäi segaseks: polnud selge, mida see mõõdab ja mille põhjal protsendid arvutatakse. Tulemus „100% kindel“ tekitab põhjendamatut usaldust. 3D-vaade: jäi selgusetuks, mida tähendavad suured ja väikesed mummud ilma seletusteta. Vaikesätted peaks näitama kogu mummukeste pilve ja alamenüü taga peidetult peaks saama vaid filtreerida ja seal hulgas ka heleduse järgi and the slider labels should be more easily readable. Värvide väärtused tabelis on jagatud mitmele reale, ühel real oleks need loetavamad. Add the gray used in scientific tests where just noticable difference is tested as one of the default background options saved everywhere. verify backend algorithms using lean build, model them properly in documentation and find possible improvement places,locally using lean build a plan for a better algorithm and test it repeat if nessassary build and give a seperate local test build to test out.

Answers:
- Lean: install via winget. (A complete Lean 4.36.0 toolchain from P-010 was found and used, because the winget toolchain download failed for lack of disk space.)
- Improved algorithms: "Local test build only".
- Colour names: the full `color-name-list`, loaded lazily.
- Base: a sync PR from main to develop-frontend first (#89).
- 3D view default: "All dots in full colour".
- Artefacts: "Show as explained score".
- Upload and grey: "Drag-and-drop upload box", "Remember chosen backgrounds", "JND grey preset in every picker", "for 2 use the actual standardized gray used in lab tests when comparing colors according to international standards replace one of the other grays allready there".
- Colour count: "Upload form; no paging".

## P-039 (2026-11-21): Decisions from P-038

Type: approved decision
Source: P-038, the conflict review and the user's answers
Issue: #90, #91, #92

1. **3D view defaults.** They show every lattice dot in full colour: hue width 360, full chroma and lightness, neutrals included. This supersedes P-036 item 2's default selection. Cell 19's selection and the new lightness range move into a collapsed "Filtreeri" panel. The point cap is raised, so all 13,000 CIELAB dots draw. Slider labels become larger, with the value and units in a badge.
2. **Artefacts.** The per-colour artefact value is shown as an explained similarity score, "Segupiksli sarnasus", with a tooltip saying what is measured and how. This supersedes the "chance" wording of P-032 and P-033 for display. The data field stays `chance`, and #95 asks the team to rename or redefine it.
3. **Confidence.** Findings show confidence in words (madal, keskmine, kõrge) with the reason, never as "100 %".
4. **Background grey.** The background grey is the CIE reference background for colour-difference evaluation: a uniform neutral grey of CIE L* = 50 (CIE 116-1995, the reference conditions of CIEDE2000), which is sRGB #777777 (L* 50.04). It replaces the "hall" preset in the pixel viewer and the 3D view.
5. **Remembered backgrounds.** Each viewer remembers its chosen background in localStorage, through a port. This supersedes P-037 item 3.
6. **Drag and drop.** Upload gets a drag-and-drop box. Dropped files pass the same checks as picked ones. Multiple files stay in #15. This pulls single-image drag and drop forward from P-018 item 1 and P-020 item 1.
7. **Colour count.** The count chosen on the upload form is shown everywhere: heading, hint, filter counts, the 3D view and the demo. The table still renders all N rows at once, with no paging. Speed comes from memoising the per-row work.
8. **Colour names.** Every colour code in the app's own pages gets a name from `color-name-list`: the nearest name by ΔE_OK, marked as approximate (≈). This excludes the extension popup and the Figma plugin. The names are English proper names; the UI stays Estonian.
9. **Algorithms delivered locally only.** The improved algorithms stay in a local test build that is never pushed. This supersedes P-031 item 10's prototype sharing for this work. The findings reach the team as `docs/algorithms/` (#92) and the backend issues #93–#96, and the Lean sources stay local.
10. **Ownership in `src/core/analysis/`.** The teammates own `blends.ts`, `palette-clusters.ts`, `harmonies.ts`, `contrast.ts`, `gamut-coverage.ts`, `ui-mode.ts`, `palette-types.ts`, `compute-color-analysis.ts`, `src/core/count-colors.ts` and the Supabase adapters. The frontend files (`color-filter.ts`, `share-bands.ts`, `format.ts`, `ontology.ts`, `color-analysis.ts` types, `color-analysis-check.ts`) may change.
11. [UNDERSTANDING] **Zoom.** The pixel viewer accumulates small wheel and trackpad deltas, moving one zoom level per about 100 px. The 3D view's wheel zoom is gentler, with the step per event capped. Plain scrolling keeps its P-021 and P-036 meaning.
12. [UNDERSTANDING] **Analysis cache.** Caching the analysis result is a frontend decorator around the `AnalysisService` port, not an edit inside the Supabase adapter. Any server-side speed-up goes to the team as an issue.

## P-040 (2026-11-21): Table speed and colour-name decisions

Type: approved decision
Source: the user's answer, the performance analysis and the library audit
Issue: #90, #91

1. "Determine which would be faster" — measured on 5000 colours in vitest/jsdom:
   - filter logic: 0.2 ms;
   - the analysis: 21 ms;
   - OKLCH text: 4.3 ms;
   - building the table rows: 4.6 s.

   [AUDIT: performance-analyst] Server-side filtering would be slower: it adds a network round trip and leaves the row-building cost unchanged. Row virtualisation would be fastest, but the user chose "No, keep all rows rendered". So the table renders every row, with memoised rows and deferred filtering (P-039 item 7 stands).
2. Colour names use `color-name-list@14.86.0`: MIT, 32,004 names, about 318 KB gzip, loaded with `import()` only when needed [AUDIT: library-auditor]. The nearest-name search is our own: an OKLab grid index searched until no unsearched cell can be nearer, tested against brute force. `nearest-color` was rejected because it measures distance in RGB.

## P-041 (2026-11-21): Audits recorded after the compliance review

Type: approved decision
Source: library-auditor, performance-analyst and local measurements
Issue: #91

1. [AUDIT: library-auditor] Drag-and-drop upload uses the platform API (`DataTransfer.files` plus the native file input), with no library. react-dropzone, Uppy and FilePond add nothing a single-image box needs. Re-audit react-dropzone if #15 brings multiple files or folders.
2. [AUDIT: performance-analyst] Colour names need no Web Worker. Building the index is a one-time cost, measured at 33 ms in Node. Lookups are cached per colour. 5000 table rows render in about 1.7 s in jsdom with or without names (measured), so names add no measurable cost. The name list loads only when a component that shows a name mounts.
