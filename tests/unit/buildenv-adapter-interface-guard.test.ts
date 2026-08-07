/**
 * Interface-contract guard for AgentAdapter.buildEnv.
 *
 * The hazard this exists to catch is DOUBLE-INJECTED MCP CONFIG: most adapters
 * wire MCP via a CLI flag (Claude: --mcp-config) or a settings file
 * (Codex/Gemini: hooks injection), so an adapter that also delivered MCP through
 * the environment would configure it twice. OpenCode is the one adapter that
 * delivers MCP config via env var, because it has neither a --mcp-config flag
 * nor a shared settings-file hook system.
 *
 * buildEnv is not MCP-only, though: Claude implements it to select the config
 * directory (which ACCOUNT the CLI authenticates as), which the CLI exposes
 * through `CLAUDE_CONFIG_DIR` and nowhere else. So the guard is an allowlist of
 * implementers plus a check that no implementer smuggles MCP config through the
 * environment behind its own flag-based wiring.
 *
 * If a new adapter legitimately needs buildEnv, add its name to
 * ADAPTERS_WITH_BUILDENV below and document why.
 */

import { describe, it, expect } from 'vitest';
import { agentRegistry } from '../../src/main/agent/agent-registry';
import type { SpawnCommandOptions } from '../../src/main/agent/agent-adapter';

/**
 * Adapter names EXPECTED to implement buildEnv, and why:
 *
 * - opencode: delivers the Kangentic MCP server config via
 *   `OPENCODE_CONFIG_CONTENT`; it has no --mcp-config flag.
 * - claude: selects the account's config directory via `CLAUDE_CONFIG_DIR`.
 *   Its MCP config still goes through --mcp-config, NOT the environment.
 */
const ADAPTERS_WITH_BUILDENV: ReadonlySet<string> = new Set(['opencode', 'claude']);

/** Adapters whose MCP wiring is flag- or settings-file-based, so their env must stay MCP-free. */
const MCP_MUST_NOT_BE_IN_ENV: ReadonlySet<string> = new Set(['claude']);

function spawnOptionsWithMcp(): SpawnCommandOptions {
  return {
    agentPath: '/usr/local/bin/agent',
    taskId: 'task-guard-1',
    cwd: '/projects/repo',
    permissionMode: 'acceptEdits',
    mcpServerEnabled: true,
    mcpServerUrl: 'http://127.0.0.1:41999/mcp',
    mcpServerToken: 'guard-token',
  } as SpawnCommandOptions;
}

describe('AgentAdapter.buildEnv interface guard', () => {
  it('only allowlisted adapters implement buildEnv', () => {
    const allAdapterNames = agentRegistry.list();

    // Sanity: the registry must have at least one adapter registered.
    expect(allAdapterNames.length).toBeGreaterThan(0);

    const unexpectedAdapters: string[] = [];
    const missingExpectedAdapters: string[] = [];

    for (const adapterName of allAdapterNames) {
      const adapter = agentRegistry.get(adapterName)!;
      const hasBuildEnv = typeof adapter.buildEnv === 'function';

      if (hasBuildEnv && !ADAPTERS_WITH_BUILDENV.has(adapterName)) {
        unexpectedAdapters.push(adapterName);
      }
      if (!hasBuildEnv && ADAPTERS_WITH_BUILDENV.has(adapterName)) {
        missingExpectedAdapters.push(adapterName);
      }
    }

    if (unexpectedAdapters.length > 0) {
      throw new Error(
        `Unexpected adapters with buildEnv: ${unexpectedAdapters.join(', ')}. `
        + `If this adapter intentionally delivers config via env var, add it to ADAPTERS_WITH_BUILDENV in this test.`,
      );
    }

    if (missingExpectedAdapters.length > 0) {
      throw new Error(
        `Expected adapters are missing buildEnv: ${missingExpectedAdapters.join(', ')}. `
        + `These adapters are listed in ADAPTERS_WITH_BUILDENV but do not implement the method.`,
      );
    }
  });

  it('every allowlisted adapter has a callable buildEnv', () => {
    for (const adapterName of ADAPTERS_WITH_BUILDENV) {
      const adapter = agentRegistry.get(adapterName);
      expect(adapter, `Adapter "${adapterName}" is allowlisted but not registered`).toBeDefined();
      expect(typeof adapter?.buildEnv).toBe('function');
    }
  });

  it('adapters outside the allowlist have buildEnv === undefined', () => {
    for (const adapterName of agentRegistry.list()) {
      if (ADAPTERS_WITH_BUILDENV.has(adapterName)) continue;
      const adapter = agentRegistry.get(adapterName)!;
      expect(
        adapter.buildEnv,
        `Adapter "${adapterName}" unexpectedly implements buildEnv - MCP for this adapter should use --mcp-config or settings-file injection, not env vars`,
      ).toBeUndefined();
    }
  });

  it('a flag-wired adapter never smuggles MCP config through the environment', () => {
    // The original regression this guard was written for: an adapter that wires
    // MCP via --mcp-config ALSO emitting it as env, configuring it twice.
    for (const adapterName of MCP_MUST_NOT_BE_IN_ENV) {
      const adapter = agentRegistry.get(adapterName)!;
      const env = adapter.buildEnv?.(spawnOptionsWithMcp()) ?? {};
      const serialized = JSON.stringify(env);
      expect(serialized, `${adapterName} leaked the MCP server URL into the spawn env`).not.toContain('41999');
      expect(serialized, `${adapterName} leaked the MCP server token into the spawn env`).not.toContain('guard-token');
      for (const key of Object.keys(env)) {
        expect(key.toUpperCase(), `${adapterName} set an MCP-looking env key`).not.toContain('MCP');
      }
    }
  });
});
