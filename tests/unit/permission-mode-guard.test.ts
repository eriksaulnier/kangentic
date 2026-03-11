/**
 * Unit tests for the permission mode guard logic in handleTaskMove Priority 3.
 *
 * Tests the decision: when a task with an active session moves to a new column,
 * should the session be suspended + resumed (for permission mode changes or
 * auto_command injection), or kept alive?
 *
 * Also tests resumePrompt derivation: suspended sessions get auto_command
 * preloaded as the resume prompt; fresh spawns use deferred injection instead.
 */
import { describe, it, expect } from 'vitest';
import type { PermissionMode } from '../../src/shared/types';

/**
 * Replicates the Priority 3 suspend decision from handleTaskMove.
 * Returns true when the session should be suspended + resumed.
 */
function shouldSuspendSession(
  currentPermissionMode: PermissionMode,
  targetPermissionMode: PermissionMode,
  autoCommand: string | null,
): boolean {
  const permissionModeChanged = currentPermissionMode !== targetPermissionMode;
  return permissionModeChanged || !!autoCommand;
}

/**
 * Replicates the resumePrompt derivation from handleTaskMove Priority 4.
 * When a suspended session exists and auto_command is configured, the command
 * is preloaded as the resume prompt (deterministic, no blind PTY timing).
 * For fresh spawns, returns undefined (deferred injection is used instead).
 */
function deriveResumePrompt(
  autoCommand: string | null,
  wasSuspended: boolean,
): string | undefined {
  return (autoCommand && wasSuspended) ? autoCommand : undefined;
}

describe('Permission mode guard', () => {
  describe('shouldSuspendSession', () => {
    it('keeps session alive when same mode and no auto_command', () => {
      expect(shouldSuspendSession('default', 'default', null)).toBe(false);
    });

    it('keeps session alive for identical explicit modes without auto_command', () => {
      expect(shouldSuspendSession('plan', 'plan', null)).toBe(false);
      expect(shouldSuspendSession('bypass-permissions', 'bypass-permissions', null)).toBe(false);
      expect(shouldSuspendSession('manual', 'manual', null)).toBe(false);
    });

    it('suspends when permission mode changes (plan to default)', () => {
      expect(shouldSuspendSession('plan', 'default', null)).toBe(true);
    });

    it('suspends when permission mode changes (default to plan)', () => {
      expect(shouldSuspendSession('default', 'plan', null)).toBe(true);
    });

    it('suspends when permission mode changes (default to bypass-permissions)', () => {
      expect(shouldSuspendSession('default', 'bypass-permissions', null)).toBe(true);
    });

    it('suspends when auto_command is set even with same permission mode', () => {
      expect(shouldSuspendSession('default', 'default', '/code-review')).toBe(true);
    });

    it('suspends when both permission mode changes and auto_command is set', () => {
      expect(shouldSuspendSession('plan', 'default', '/code-review')).toBe(true);
    });

    it('suspends for any non-null auto_command string', () => {
      expect(shouldSuspendSession('default', 'default', '/test')).toBe(true);
      expect(shouldSuspendSession('default', 'default', 'run tests')).toBe(true);
    });

    it('does not suspend for empty string auto_command (falsy)', () => {
      // Empty string is falsy, treated the same as null
      expect(shouldSuspendSession('default', 'default', '')).toBe(false);
    });
  });

  describe('deriveResumePrompt', () => {
    it('preloads auto_command when session was suspended', () => {
      expect(deriveResumePrompt('/code-review', true)).toBe('/code-review');
    });

    it('returns undefined for fresh spawns (no suspended session)', () => {
      expect(deriveResumePrompt('/code-review', false)).toBeUndefined();
    });

    it('returns undefined when no auto_command even if suspended', () => {
      expect(deriveResumePrompt(null, true)).toBeUndefined();
    });

    it('returns undefined when neither auto_command nor suspended', () => {
      expect(deriveResumePrompt(null, false)).toBeUndefined();
    });

    it('returns the interpolated command string verbatim', () => {
      const command = '/code-review --branch feature/login';
      expect(deriveResumePrompt(command, true)).toBe(command);
    });
  });

  describe('permission mode resolution', () => {
    /**
     * Replicates how currentPermissionMode is resolved:
     * sessionRecord.permission_mode ?? effectiveConfig.claude.permissionMode
     */
    function resolveCurrentMode(
      sessionPermissionMode: string | null | undefined,
      configDefault: PermissionMode,
    ): PermissionMode {
      return (sessionPermissionMode ?? configDefault) as PermissionMode;
    }

    /**
     * Replicates how targetPermissionMode is resolved:
     * toLane.permission_strategy ?? effectiveConfig.claude.permissionMode
     */
    function resolveTargetMode(
      lanePermissionStrategy: PermissionMode | null,
      configDefault: PermissionMode,
    ): PermissionMode {
      return lanePermissionStrategy ?? configDefault;
    }

    it('uses session record mode when available', () => {
      expect(resolveCurrentMode('plan', 'default')).toBe('plan');
    });

    it('falls back to config default when session has no mode', () => {
      expect(resolveCurrentMode(null, 'default')).toBe('default');
      expect(resolveCurrentMode(undefined, 'default')).toBe('default');
    });

    it('uses lane strategy when set', () => {
      expect(resolveTargetMode('plan', 'default')).toBe('plan');
    });

    it('falls back to config default when lane has no strategy', () => {
      expect(resolveTargetMode(null, 'default')).toBe('default');
    });

    it('detects mismatch when session was plan but target uses config default', () => {
      const current = resolveCurrentMode('plan', 'default');
      const target = resolveTargetMode(null, 'default');
      expect(shouldSuspendSession(current, target, null)).toBe(true);
    });

    it('detects no mismatch when both resolve to config default', () => {
      const current = resolveCurrentMode(null, 'default');
      const target = resolveTargetMode(null, 'default');
      expect(shouldSuspendSession(current, target, null)).toBe(false);
    });

    it('detects mismatch when config default changed after spawn', () => {
      // Session was spawned with 'default', but config was later changed to 'plan'.
      // The session record still says 'default', target lane has no override,
      // so target resolves to config default 'plan'.
      const current = resolveCurrentMode('default', 'plan');
      const target = resolveTargetMode(null, 'plan');
      expect(shouldSuspendSession(current, target, null)).toBe(true);
    });
  });
});
