import os from 'node:os';
import path from 'node:path';

/**
 * Resolve a configured Claude config dir to an absolute path, expanding a
 * leading `~`. Returns null when no profile is configured.
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
 * Environment overrides for a spawned Claude CLI session.
 *
 * `CLAUDE_CONFIG_DIR` resolves to null when no profile is configured, which
 * deletes the variable from the child environment. The primary account MUST be
 * selected by unsetting the variable, never by setting it to the primary's own
 * path: that points the macOS credential store at a second, empty Keychain item
 * and logs the primary account out.
 */
export function claudeSessionEnv(
  configDir: string | null | undefined,
  phaseOutputPath?: string,
): Record<string, string | null> {
  return {
    CLAUDE_CONFIG_DIR: resolveClaudeConfigDir(configDir),
    ...(phaseOutputPath ? { KANGENTIC_PHASE_FILE: phaseOutputPath } : {}),
  };
}
