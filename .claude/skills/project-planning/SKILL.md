---
name: project-planning
description: Plan milestones and maintain GitHub issues, the backlog, timeline board and Kanban board. Use when planning work, creating or ordering issues, or recording an external dependency or placeholder.
---

# Project planning

Maintain these structures in GitHub:

- Project backlog
- Timeline board
- Kanban board
- Milestones
- Releases

Use one GitHub Project with backlog, timeline and Kanban views, so all three share the same items and stay synchronized.

## Planning work

1. Plan milestones in advance, and organize work into logical, achievable stages.
2. Create an issue for every significant development task.
3. Order issues logically, taking dependencies and architectural requirements into account.
4. Assign each issue to a milestone and add it to the GitHub Project.
5. When an issue changes state, update its status so every view stays correct.

Useful commands:

```bash
gh issue create --title "<title>" --body "<body>" --milestone "<milestone>" --label "<label>"
gh project item-add <project-number> --owner <owner> --url <issue-url>
gh project item-list <project-number> --owner <owner>
```

## External work and placeholders

If a task needs something created, configured or connected outside this project:

1. Create an issue with the `external-dependency` label that says exactly what is needed and where.
2. Add it to the milestone and GitHub Project.
3. If the code uses a dummy value meanwhile, also apply the `placeholder` label and mark the code with `PLACEHOLDER(#issue)`.

Never silently leave an integration or dependency unfinished or undocumented.
