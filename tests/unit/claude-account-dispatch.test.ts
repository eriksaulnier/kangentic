/**
 * End-to-end coverage of the account dispatch chain, from a task row to the
 * environment block a PTY would actually be spawned with:
 *
 *   resolveSpawnOverrides  ->  CommandOptions.configDir
 *                          ->  ClaudeAdapter.buildEnv
 *                          ->  buildSpawnEnv
 *                          ->  pty.spawn({ env })
 *
 * The individual links are covered elsewhere (resolve-spawn-overrides,
 * pty-spawn, trust-manager). This file exists because every one of them can be
 * right while the CHAIN is wrong, and the failure is silent in the worst way:
 * the task runs, produces output, and bills the wrong account's rate limit.
 *
 * Two chain-level bugs this pins, both of which shipped broken once:
 *   - a stored `~/.claude2` reaching the child verbatim. Environment values are
 *     not shell-expanded, so the CLI reads a directory literally named `~`
 *     relative to the worktree and lands on an empty profile.
 *   - "use the default account" failing to REMOVE an inherited
 *     CLAUDE_CONFIG_DIR, so a Kangentic launched from a shell that exports one
 *     runs every default-account task on that profile instead.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// The chain reaches electron through analytics. Nothing here touches either;
// the mock only keeps the import graph resolvable (same shape the other
// spawn-path suites use).
vi.mock('../../src/main/analytics/analytics', () => ({
  trackEvent: vi.fn(),
  sanitizeErrorMessage: (message: string) => message,
}));

import { ClaudeAdapter } from '../../src/main/agent/adapters/claude/claude-adapter';
import { resolveSpawnOverrides } from '../../src/main/ipc/helpers/agent-spawn';
import { buildSpawnEnv } from '../../src/main/pty/spawn/pty-spawn';
import type { SpawnCommandOptions } from '../../src/main/agent/agent-adapter';

const KEY = 'CLAUDE_CONFIG_DIR';
const adapter = new ClaudeAdapter();

/** A lane with no account opinion - the ladder deliberately has no lane rung. */
function lane() {
  return {
    id: 'lane-1',
    model_override: null,
    effort_override: null,
    session_target: 'main' as const,
    session_spawn_strategy: 'create_or_resume' as const,
  };
}

/**
 * Run the real chain: resolve the ladder, feed the resolved value through the
 * adapter's env builder, and merge it the way the spawn flow does.
 */
function spawnEnvFor(taskConfigDir: string | null, effectiveConfigDir: string | null): Record<string, string> {
  const overrides = resolveSpawnOverrides(
    { model_override: null, effort_override: null, config_dir: taskConfigDir },
    lane(),
    null,
    effectiveConfigDir,
  );
  const commandOptions = {
    agentPath: '/usr/local/bin/claude',
    taskId: 'task-1',
    cwd: '/projects/repo',
    permissionMode: 'acceptEdits',
    configDir: overrides.configDir,
  } as SpawnCommandOptions;
  return buildSpawnEnv(adapter.buildEnv(commandOptions) ?? {});
}

afterEach(() => {
  delete process.env[KEY];
});

describe('Claude account dispatch, end to end', () => {
  it('an absolute per-task directory reaches the spawn env unchanged', () => {
    const env = spawnEnvFor('/Users/dev/.claude2', null);
    expect(env[KEY]).toBe('/Users/dev/.claude2');
  });

  it('expands a stored ~ so the child gets a real path, not a directory named "~"', () => {
    const env = spawnEnvFor('~/.claude2', null);
    expect(env[KEY]).toBe(path.join(os.homedir(), '.claude2'));
    expect(env[KEY]).not.toContain('~');
  });

  it('the task pin beats the project/global value', () => {
    const env = spawnEnvFor('~/.claude3', '~/.claude2');
    expect(env[KEY]).toBe(path.join(os.homedir(), '.claude3'));
  });

  it('falls back to the project/global value when the task has no pin', () => {
    const env = spawnEnvFor(null, '~/.claude2');
    expect(env[KEY]).toBe(path.join(os.homedir(), '.claude2'));
  });

  it('DELETES an inherited variable when nothing is configured (default account)', () => {
    process.env[KEY] = '/Users/dev/.claude-from-shell';
    const env = spawnEnvFor(null, null);
    expect(KEY in env).toBe(false);
  });

  it('a task pin overrides an inherited variable rather than losing to it', () => {
    process.env[KEY] = '/Users/dev/.claude-from-shell';
    const env = spawnEnvFor('~/.claude3', null);
    expect(env[KEY]).toBe(path.join(os.homedir(), '.claude3'));
  });

  it('two tasks pinned to different accounts get different directories', () => {
    const first = spawnEnvFor('~/.claude2', null);
    const second = spawnEnvFor('~/.claude3', null);
    expect(first[KEY]).not.toBe(second[KEY]);
    expect(first[KEY]).toBe(path.join(os.homedir(), '.claude2'));
    expect(second[KEY]).toBe(path.join(os.homedir(), '.claude3'));
  });

  it('never hands the child an empty string, which the CLI reads as a real path', () => {
    for (const configured of [null, '', '~/.claude2']) {
      const env = spawnEnvFor(configured as string | null, null);
      expect(env[KEY]).not.toBe('');
    }
  });
});
