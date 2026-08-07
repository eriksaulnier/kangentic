import os from 'node:os';
import path from 'node:path';

/**
 * Resolve a configured Claude config directory to an absolute path, expanding a
 * leading `~`. Returns null when no directory is configured, which every caller
 * reads as "the CLI's own default location".
 *
 * The tilde form is what users type (`~/.claude-work`), and it reaches here
 * verbatim from settings: the value is stored as entered so it stays portable
 * across machines with different home directories.
 */
export function resolveClaudeConfigDir(configDir: string | null | undefined): string | null {
  if (!configDir) return null;
  if (configDir === '~') return os.homedir();
  if (configDir.startsWith('~/') || configDir.startsWith('~\\')) {
    return path.join(os.homedir(), configDir.slice(2));
  }
  return configDir;
}

/**
 * Where Claude Code keeps the per-directory trust decisions, MCP approvals and
 * project state that `trust-manager` pre-populates.
 *
 * The file lives INSIDE the config directory, so a spawn running under a
 * non-default directory reads a different file than `~/.claude.json`. Writing
 * the trust entry to the wrong one leaves every worktree spawn under that
 * account sitting on the "Is this a project you trust?" dialog.
 */
export function claudeJsonPathFor(configDir: string | null | undefined): string {
  return path.join(resolveClaudeConfigDir(configDir) ?? os.homedir(), '.claude.json');
}
