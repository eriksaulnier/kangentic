import * as fs from 'node:fs';
import * as path from 'node:path';
import { toForwardSlash } from '../../../../shared/paths';
import { createSerialLock } from '../../shared/relocation-utils';
import { claudeJsonPathFor } from './config-dir';

// One promise chain per `.claude.json`, serializing read-modify-write races
// between concurrently spawned tasks. Both ensureWorktreeTrust and
// ensureMcpServerTrust target the same file, so one lock covers both.
//
// Keyed by resolved file path rather than shared globally: two tasks pinned to
// different config directories write different files and have no reason to
// queue behind each other, which is the whole point of running them on separate
// accounts.
const locksByClaudeJsonPath = new Map<string, ReturnType<typeof createSerialLock>>();

function lockFor(configDir: string | null | undefined): ReturnType<typeof createSerialLock> {
  const key = claudeJsonPathFor(configDir);
  let lock = locksByClaudeJsonPath.get(key);
  if (!lock) {
    lock = createSerialLock();
    locksByClaudeJsonPath.set(key, lock);
  }
  return lock;
}

/**
 * The lock for the DEFAULT `~/.claude.json`. Exported for project relocation,
 * which only ever rewrites the default location. Resolving through `lockFor`
 * (rather than a fresh `createSerialLock()`) is what keeps relocation and a
 * default-account trust write on the same chain.
 *
 * A function rather than a resolved lock so the home directory is read when the
 * lock is USED, not when this module is imported.
 */
export const withClaudeJsonLock = <T>(operation: () => T | Promise<T>): Promise<T> =>
  lockFor(null)(operation);

/**
 * Pre-populate Claude Code's trust entry for a worktree path so the
 * "Is this a project you trust?" prompt is skipped when spawning an agent.
 *
 * Claude Code stores per-directory trust in `<configDir>/.claude.json` under
 * `projects[<resolved-path>].hasTrustDialogAccepted`. Under a non-default
 * config directory that is not `~/.claude.json`, so writing there would leave
 * that account's agent blocked on the trust dialog at every spawn.
 */
export async function ensureWorktreeTrust(worktreePath: string, configDir?: string | null): Promise<void> {
  return lockFor(configDir)(() => ensureWorktreeTrustSync(worktreePath, configDir));
}

function ensureWorktreeTrustSync(worktreePath: string, configDir?: string | null): void {
  const claudeJsonPath = claudeJsonPathFor(configDir);
  const resolvedPath = toForwardSlash(path.resolve(worktreePath));

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8'));
  } catch {
    data = {};
  }

  if (!data.projects || typeof data.projects !== 'object') {
    data.projects = {};
  }
  const projects = data.projects as Record<string, Record<string, unknown>>;

  // Already trusted - nothing to do
  if (projects[resolvedPath]?.hasTrustDialogAccepted === true) {
    return;
  }

  // Copy MCP server approvals from the parent project entry if it exists.
  // The parent project is the repo root (worktree paths live under .kangentic/worktrees/).
  let parentMcpServers: string[] = [];
  const markerIdx = resolvedPath.indexOf('/.kangentic/worktrees/');
  if (markerIdx !== -1) {
    const parentPath = resolvedPath.substring(0, markerIdx);
    const parentEntry = projects[parentPath];
    if (parentEntry && Array.isArray(parentEntry.enabledMcpjsonServers)) {
      parentMcpServers = parentEntry.enabledMcpjsonServers as string[];
    }
  }

  projects[resolvedPath] = {
    allowedTools: [],
    enabledMcpjsonServers: parentMcpServers,
    disabledMcpjsonServers: [],
    ...(projects[resolvedPath] || {}),
    hasTrustDialogAccepted: true,
  };

  fs.writeFileSync(claudeJsonPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Ensure the "kangentic" MCP server is listed in enabledMcpjsonServers
 * for a project path so Claude Code auto-enables it without prompting.
 *
 * Called for all sessions (main repo and worktrees).
 */
export async function ensureMcpServerTrust(projectPath: string, configDir?: string | null): Promise<void> {
  return lockFor(configDir)(() => ensureMcpServerTrustSync(projectPath, configDir));
}

function ensureMcpServerTrustSync(projectPath: string, configDir?: string | null): void {
  const claudeJsonPath = claudeJsonPathFor(configDir);
  const resolvedPath = toForwardSlash(path.resolve(projectPath));

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8'));
  } catch {
    data = {};
  }

  if (!data.projects || typeof data.projects !== 'object') {
    data.projects = {};
  }
  const projects = data.projects as Record<string, Record<string, unknown>>;

  if (!projects[resolvedPath]) {
    projects[resolvedPath] = {};
  }

  const entry = projects[resolvedPath];
  const enabledServers = Array.isArray(entry.enabledMcpjsonServers)
    ? entry.enabledMcpjsonServers as string[]
    : [];

  if (enabledServers.includes('kangentic')) {
    return; // Already trusted
  }

  entry.enabledMcpjsonServers = [...enabledServers, 'kangentic'];
  fs.writeFileSync(claudeJsonPath, JSON.stringify(data, null, 2), 'utf-8');
}
