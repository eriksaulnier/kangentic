import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  injectEventHooks,
  stripActivityHooks,
} from '../../src/main/agent/hook-manager';

let tmpDir: string;
const ACTIVITY_BRIDGE = '/fake/.kangentic/activity-bridge.js';
const EVENT_BRIDGE = '/fake/.kangentic/event-bridge.js';
const ACTIVITY_PATH = '/fake/.kangentic/sessions/abc/activity.json';
const EVENTS_PATH = '/fake/.kangentic/sessions/abc/events.jsonl';

function readSettings(): any {
  const p = path.join(tmpDir, '.claude', 'settings.local.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function settingsExists(): boolean {
  return fs.existsSync(path.join(tmpDir, '.claude', 'settings.local.json'));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookman-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('hook-manager', () => {
  it('injectEventHooks creates settings file with correct hooks', () => {
    injectEventHooks(tmpDir, EVENT_BRIDGE, EVENTS_PATH);

    const settings = readSettings();
    expect(settings.hooks.PreToolUse).toHaveLength(3);
    expect(settings.hooks.PostToolUse).toHaveLength(3);
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(settings.hooks.PermissionRequest).toHaveLength(1);
    // First entry: catch-all tool_start
    expect(settings.hooks.PreToolUse[0].matcher).toBe('');
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain('event-bridge');
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain('tool_start');
    // Second entry: AskUserQuestion → idle
    expect(settings.hooks.PreToolUse[1].matcher).toBe('AskUserQuestion');
    expect(settings.hooks.PreToolUse[1].hooks[0].command).toContain('event-bridge');
    expect(settings.hooks.PreToolUse[1].hooks[0].command).toContain('idle');
    // Third entry: ExitPlanMode → idle
    expect(settings.hooks.PreToolUse[2].matcher).toBe('ExitPlanMode');
    expect(settings.hooks.PreToolUse[2].hooks[0].command).toContain('event-bridge');
    expect(settings.hooks.PreToolUse[2].hooks[0].command).toContain('idle');
    // PostToolUse: catch-all tool_end + AskUserQuestion/ExitPlanMode → prompt
    expect(settings.hooks.PostToolUse[0].matcher).toBe('');
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toContain('tool_end');
    expect(settings.hooks.PostToolUse[1].matcher).toBe('AskUserQuestion');
    expect(settings.hooks.PostToolUse[1].hooks[0].command).toContain('prompt');
    expect(settings.hooks.PostToolUse[2].matcher).toBe('ExitPlanMode');
    expect(settings.hooks.PostToolUse[2].hooks[0].command).toContain('prompt');
    // PermissionRequest → idle
    expect(settings.hooks.PermissionRequest[0].matcher).toBe('');
    expect(settings.hooks.PermissionRequest[0].hooks[0].command).toContain('event-bridge');
    expect(settings.hooks.PermissionRequest[0].hooks[0].command).toContain('idle');
    // PostToolUseFailure: catch-all → tool_failure
    expect(settings.hooks.PostToolUseFailure).toHaveLength(1);
    expect(settings.hooks.PostToolUseFailure[0].matcher).toBe('');
    expect(settings.hooks.PostToolUseFailure[0].hooks[0].command).toContain('event-bridge');
    expect(settings.hooks.PostToolUseFailure[0].hooks[0].command).toContain('tool_failure');
  });

  it('stripActivityHooks removes ALL kangentic hooks, preserves user hooks', () => {
    // Set up: user hook + both kangentic bridge types across multiple hook events
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: `node "${ACTIVITY_BRIDGE}" "${ACTIVITY_PATH}" idle` }] },
          { matcher: '', hooks: [{ type: 'command', command: `node "${EVENT_BRIDGE}" "${EVENTS_PATH}" tool_start` }] },
          { matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: `node "${EVENT_BRIDGE}" "${EVENTS_PATH}" idle` }] },
          { matcher: '', hooks: [{ type: 'command', command: 'echo user-pretool' }] },
        ],
        UserPromptSubmit: [
          { matcher: '', hooks: [{ type: 'command', command: 'echo user-hook' }] },
          { matcher: '', hooks: [{ type: 'command', command: `node "${ACTIVITY_BRIDGE}" "${ACTIVITY_PATH}" thinking` }] },
          { matcher: '', hooks: [{ type: 'command', command: `node "${EVENT_BRIDGE}" "${EVENTS_PATH}" prompt` }] },
        ],
        PermissionRequest: [
          { matcher: '', hooks: [{ type: 'command', command: `node "${ACTIVITY_BRIDGE}" "${ACTIVITY_PATH}" idle` }] },
          { matcher: '', hooks: [{ type: 'command', command: `node "${EVENT_BRIDGE}" "${EVENTS_PATH}" idle` }] },
        ],
        PostToolUse: [
          { matcher: '', hooks: [{ type: 'command', command: `node "${EVENT_BRIDGE}" "${EVENTS_PATH}" tool_end` }] },
          { matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: `node "${ACTIVITY_BRIDGE}" "${ACTIVITY_PATH}" thinking` }] },
          { matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: `node "${EVENT_BRIDGE}" "${EVENTS_PATH}" prompt` }] },
        ],
        PostToolUseFailure: [
          { matcher: '', hooks: [{ type: 'command', command: `node "${ACTIVITY_BRIDGE}" "${ACTIVITY_PATH}" idle` }] },
          { matcher: '', hooks: [{ type: 'command', command: `node "${EVENT_BRIDGE}" "${EVENTS_PATH}" tool_failure` }] },
        ],
      },
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify(settings, null, 2),
    );

    stripActivityHooks(tmpDir);

    const result = readSettings();
    expect(result.hooks.UserPromptSubmit).toHaveLength(1);
    expect(result.hooks.UserPromptSubmit[0].hooks[0].command).toBe('echo user-hook');
    expect(result.hooks.PreToolUse).toHaveLength(1);
    expect(result.hooks.PreToolUse[0].hooks[0].command).toBe('echo user-pretool');
    // PermissionRequest had only kangentic hooks — key should be removed entirely
    expect(result.hooks.PermissionRequest).toBeUndefined();
    // PostToolUse had only kangentic hooks — key should be removed entirely
    expect(result.hooks.PostToolUse).toBeUndefined();
    // PostToolUseFailure had only kangentic hooks — key should be removed entirely
    expect(result.hooks.PostToolUseFailure).toBeUndefined();
  });

  it('stripActivityHooks cleans up empty settings file', () => {
    // Create settings with only kangentic hooks
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const settings = {
      hooks: {
        UserPromptSubmit: [
          { matcher: '', hooks: [{ type: 'command', command: `node "${ACTIVITY_BRIDGE}" "${ACTIVITY_PATH}" thinking` }] },
        ],
      },
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify(settings, null, 2),
    );

    stripActivityHooks(tmpDir);

    expect(settingsExists()).toBe(false);
  });

  it('stripActivityHooks handles missing file', () => {
    // No .claude/ directory at all — should not throw
    expect(() => stripActivityHooks(tmpDir)).not.toThrow();
  });
});
