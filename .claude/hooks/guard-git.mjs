#!/usr/bin/env node
// PreToolUse hook for the Bash tool.
// Blocks direct pushes to main and the integration branch, Pull Request merges
// and Pull Request approvals. Exit code 2 blocks the command.
// GitHub branch protection remains the real backstop: this hook cannot see
// through shell variables, scripts or aliases.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const protectedBranches = new Set(['main']);
const WRAPPERS = new Set(['env', 'command', 'sudo', 'time', 'nohup', 'exec']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);
const GIT_OPTIONS_WITH_VALUE = new Set(['-c', '--git-dir', '--work-tree', '--namespace']);
const PUSH_OPTIONS_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);
const PUSH_EVERYTHING = new Set(['--all', '--branches', '--mirror']);

// Splits a shell command into simple commands, respecting quotes.
function parseCommands(text) {
  const commands = [];
  let tokens = [];
  let token = '';
  let hasToken = false;
  let quote = null;

  const endToken = () => {
    if (hasToken) tokens.push(token);
    token = '';
    hasToken = false;
  };
  const endCommand = () => {
    endToken();
    if (tokens.length > 0) commands.push(tokens);
    tokens = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === '\\' && quote === '"' && i + 1 < text.length) token += text[(i += 1)];
      else token += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      hasToken = true;
    } else if (char === '\\' && i + 1 < text.length) {
      token += text[(i += 1)];
      hasToken = true;
    } else if (';|&()\n'.includes(char)) {
      endCommand();
    } else if (char === ' ' || char === '\t') {
      endToken();
    } else {
      token += char;
      hasToken = true;
    }
  }
  endCommand();
  return commands;
}

function withoutRedirects(tokens) {
  const kept = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (/^\d*[<>]+$/.test(tokens[i])) i += 1;
    else if (!/^\d*[<>]/.test(tokens[i])) kept.push(tokens[i]);
  }
  return kept;
}

function currentBranch(directory) {
  try {
    return execFileSync('git', ['-C', directory, 'branch', '--show-current'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function refspecTargetsProtected(refspec, directory) {
  const spec = refspec.replace(/^\+/, '');
  const colon = spec.indexOf(':');
  const source = colon === -1 ? spec : spec.slice(0, colon);
  const destination = colon === -1 ? spec : spec.slice(colon + 1) || source;
  const name = destination.replace(/^refs\/heads\//, '');

  if (name === 'HEAD' || name === '@') return protectedBranches.has(currentBranch(directory));
  return protectedBranches.has(name) || name.includes('*');
}

function pushViolation(args, directory) {
  const positionals = [];
  let repoGiven = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (PUSH_EVERYTHING.has(arg)) return `git push ${arg} includes protected branches`;
    if (arg === '--repo' || arg.startsWith('--repo=')) repoGiven = true;
    if (PUSH_OPTIONS_WITH_VALUE.has(arg)) i += 1;
    else if (!arg.startsWith('-')) positionals.push(arg);
  }

  const refspecs = repoGiven ? positionals : positionals.slice(1);
  const blocked =
    refspecs.length === 0
      ? protectedBranches.has(currentBranch(directory))
      : refspecs.some((refspec) => refspecTargetsProtected(refspec, directory));

  return blocked
    ? `pushing directly to a protected branch (${[...protectedBranches].join(', ')}) is not allowed`
    : null;
}

function gitViolation(args, cwd) {
  let directory = cwd;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-C') directory = resolve(directory, args[(i += 1)] ?? '.');
    else if (GIT_OPTIONS_WITH_VALUE.has(arg)) i += 1;
    else if (!arg.startsWith('-')) {
      return arg === 'push' ? pushViolation(args.slice(i + 1), directory) : null;
    }
  }
  return null;
}

function commandViolation(rawTokens, cwd) {
  const tokens = withoutRedirects(rawTokens);
  let start = 0;
  while (
    start < tokens.length &&
    (/^[A-Za-z_]\w*=/.test(tokens[start]) || WRAPPERS.has(basename(tokens[start])))
  ) {
    start += 1;
  }

  const program = basename(tokens[start] ?? '');
  const args = tokens.slice(start + 1);

  if (program === 'git') return gitViolation(args, cwd);
  if (program === 'gh') {
    const pr = args.indexOf('pr');
    if (pr === -1) return null;
    if (args[pr + 1] === 'merge') return 'merging is left to the developer';
    const approves = args.slice(pr + 2).some((arg) => arg === '--approve' || /^-[a-z]*a[a-z]*$/.test(arg));
    return args[pr + 1] === 'review' && approves ? 'Claude never approves Pull Requests' : null;
  }
  if (program === 'eval') return violation(args.join(' '), cwd);
  if (SHELLS.has(program)) {
    const flag = args.findIndex((arg) => /^-[a-z]*c$/.test(arg));
    return flag !== -1 && args[flag + 1] ? violation(args[flag + 1], cwd) : null;
  }
  return null;
}

function violation(command, cwd) {
  for (const tokens of parseCommands(command)) {
    const reason = commandViolation(tokens, cwd);
    if (reason) return reason;
  }
  return null;
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  try {
    const config = JSON.parse(readFileSync(join(projectDir, '.claude', 'project.json'), 'utf8'));
    const integrationBranch = String(config.integrationBranch ?? '').trim();
    if (integrationBranch) protectedBranches.add(integrationBranch);
  } catch {
    // No project config yet: protect main only.
  }
  const reason = violation(input.tool_input?.command ?? '', input.cwd ?? process.cwd());
  if (reason) {
    console.error(`Blocked: ${reason}. Use a feature branch and leave merging to the developer.`);
    process.exit(2);
  }
} catch (error) {
  console.error(`Blocked: guard-git could not check this command (${error.message}).`);
  process.exit(2);
}
