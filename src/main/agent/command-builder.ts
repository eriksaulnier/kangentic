import type { PermissionMode, Task, SkillConfig } from '../../shared/types';

interface CommandOptions {
  claudePath: string;
  taskId: string;
  prompt: string;
  cwd: string;
  permissionMode: PermissionMode;
  sessionId?: string;
}

export class CommandBuilder {
  buildClaudeCommand(options: CommandOptions): string {
    const parts = [this.quoteArg(options.claudePath)];

    // Permission mode flags
    switch (options.permissionMode) {
      case 'dangerously-skip':
        parts.push('--dangerously-skip-permissions');
        break;
      case 'plan-mode':
        parts.push('--plan');
        break;
      case 'project-settings':
        // No flag needed - uses project's .claude/settings.json
        break;
      case 'manual':
        // No flags - full interactive mode
        break;
    }

    // Session resumption
    if (options.sessionId) {
      parts.push('--session-id', this.quoteArg(options.sessionId));
    }

    // The prompt
    parts.push('--print');
    parts.push(this.quoteArg(options.prompt));

    return parts.join(' ');
  }

  interpolateTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  private quoteArg(arg: string): string {
    if (process.platform === 'win32') {
      // Windows: use double quotes and escape internal double quotes
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    // Unix: use single quotes and escape internal single quotes
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
}
