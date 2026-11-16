---
name: release
description: Prepare and publish an official release with Semantic Versioning, release notes, a tag and a GitHub Release.
disable-model-invocation: true
argument-hint: "[version]"
---

# Release $ARGUMENTS

Plan releases around established milestones. Merging and production deployment stay with the developer. Stop and report if any check fails.

## 1. Choose the version

Use Semantic Versioning:

- MAJOR: breaking changes.
- MINOR: backward-compatible functionality.
- PATCH: backward-compatible bug fixes.

## 2. Verify

- All intended issues in the milestone are completed.
- Relevant tests and CI checks pass.
- Database migrations are in version control and apply cleanly to a fresh local database with `supabase db reset`.
- Migration requirements for production are identified and verified.
- Environment configuration is verified, with no production credentials or secrets in the repository.
- Known issues and outstanding limitations are identified.

## 3. Prepare the release

1. Create `release/<version>` from the integration branch, `integrationBranch` in `.claude/project.json`.
2. Write the release notes, covering:
   - Completed features
   - Resolved issues
   - Bug fixes
   - Breaking changes
   - Migrations
   - Relevant deployment instructions
   - Known issues and outstanding limitations
3. Open a Pull Request from `release/<version>` into `main`, then stop for the developer to review and merge it.

## 4. After the developer merges

Tag the exact commit being released and create the GitHub Release:

```bash
git fetch origin
git tag -a v<version> <merge-commit> -m "Release v<version>"
git push origin v<version>
gh release create v<version> --verify-tag --title "v<version>" --notes-file <notes-file>
```

Then update the milestone and project boards. Report any deployment steps for the developer. All production changes must be documented.
