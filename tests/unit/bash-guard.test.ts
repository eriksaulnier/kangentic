import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../../scripts/bash-guard.js');

interface DenyOutput {
  hookSpecificOutput: {
    hookEventName: string;
    permissionDecision: string;
    permissionDecisionReason: string;
  };
}

function runGuard(command: string): DenyOutput | null {
  const stdin = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command },
  });
  const result = execFileSync(process.execPath, [SCRIPT], {
    input: stdin,
    timeout: 5000,
    encoding: 'utf-8',
  });
  return result.trim() ? JSON.parse(result.trim()) : null;
}

function runGuardRaw(stdin: string): DenyOutput | null {
  const result = execFileSync(process.execPath, [SCRIPT], {
    input: stdin,
    timeout: 5000,
    encoding: 'utf-8',
  });
  return result.trim() ? JSON.parse(result.trim()) : null;
}

describe('bash-guard', () => {
  describe('blocks forbidden operators', () => {
    it('blocks &&', () => {
      const result = runGuard('cd /path && git push');
      expect(result).not.toBeNull();
      expect(result!.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(result!.hookSpecificOutput.permissionDecisionReason).toContain('&&');
    });

    it('blocks ||', () => {
      const result = runGuard('cmd1 || cmd2');
      expect(result).not.toBeNull();
      expect(result!.hookSpecificOutput.permissionDecision).toBe('deny');
    });

    it('blocks | (space-padded pipe)', () => {
      const result = runGuard('git log | head');
      expect(result).not.toBeNull();
      expect(result!.hookSpecificOutput.permissionDecision).toBe('deny');
    });

    it('blocks ; (semicolon+space)', () => {
      const result = runGuard('cmd1; cmd2');
      expect(result).not.toBeNull();
      expect(result!.hookSpecificOutput.permissionDecision).toBe('deny');
    });

    it('blocks 2>/dev/null', () => {
      const result = runGuard('cmd 2>/dev/null');
      expect(result).not.toBeNull();
      expect(result!.hookSpecificOutput.permissionDecision).toBe('deny');
    });

    it('blocks 2>&1', () => {
      const result = runGuard('cmd 2>&1');
      expect(result).not.toBeNull();
      expect(result!.hookSpecificOutput.permissionDecision).toBe('deny');
    });
  });

  describe('allows safe commands', () => {
    it('allows single commands', () => {
      expect(runGuard('git status')).toBeNull();
      expect(runGuard('npm run build')).toBeNull();
      expect(runGuard('git -C /path push')).toBeNull();
    });

    it('allows operators inside double quotes', () => {
      expect(runGuard('echo "foo && bar"')).toBeNull();
    });

    it('allows operators inside single quotes', () => {
      expect(runGuard("echo 'foo | bar'")).toBeNull();
    });

    it('allows pipe in grep regex (no space-padded pipe)', () => {
      expect(runGuard('grep "a|b" file.txt')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('ignores non-Bash tools', () => {
      const stdin = JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: 'src/main.ts' },
      });
      expect(runGuardRaw(stdin)).toBeNull();
    });

    it('handles malformed JSON (empty stdin)', () => {
      expect(runGuardRaw('')).toBeNull();
    });

    it('handles missing command field', () => {
      const stdin = JSON.stringify({
        tool_name: 'Bash',
        tool_input: {},
      });
      expect(runGuardRaw(stdin)).toBeNull();
    });
  });

  describe('deny response structure', () => {
    it('has correct hookSpecificOutput shape', () => {
      const result = runGuard('cd /path && git push');
      expect(result).not.toBeNull();
      expect(result!.hookSpecificOutput).toBeDefined();
      expect(result!.hookSpecificOutput.hookEventName).toBe('PreToolUse');
      expect(result!.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(typeof result!.hookSpecificOutput.permissionDecisionReason).toBe('string');
    });
  });
});
