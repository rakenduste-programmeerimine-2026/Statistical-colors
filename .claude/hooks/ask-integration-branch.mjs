#!/usr/bin/env node
// UserPromptSubmit hook. While the integration branch is unset, tells Claude to
// ask for it first. On UserPromptSubmit, stdout with exit code 0 is added to
// Claude's context. Once the branch is set, this prints nothing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let branch = '';
try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  const config = JSON.parse(readFileSync(join(projectDir, '.claude', 'project.json'), 'utf8'));
  branch = String(config.integrationBranch ?? '').trim();
} catch {
  branch = '';
}

if (!branch) {
  console.log(
    'Project setup: the integration branch is not set. Before doing anything else, ' +
      'ask the user which branch is the integration branch. ' +
      'Then set `integrationBranch` in `.claude/project.json`, record the answer as an ' +
      'approved decision in `docs/prompts.md`, ' +
      'and continue with the user\'s prompt.',
  );
}
