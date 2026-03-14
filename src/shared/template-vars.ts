export interface ShortcutContext {
  cwd: string;
  branchName: string;
  taskTitle: string;
  projectPath: string;
}

/**
 * Escape shell metacharacters to prevent injection.
 * Strips characters that are dangerous in both cmd.exe and POSIX shells.
 */
function escapeShellValue(value: string): string {
  // Remove characters that can break out of quotes or chain commands
  return value.replace(/[`$\\!"&|;<>(){}[\]\r\n]/g, '');
}

/**
 * Replace template variables in a shortcut command string.
 * Supported variables: {{cwd}}, {{branchName}}, {{taskTitle}}, {{projectPath}}
 *
 * Path variables (cwd, branchName, projectPath) are substituted literally
 * since they come from controlled sources. User-supplied values (taskTitle)
 * are sanitized to prevent shell injection.
 */
export function resolveShortcutCommand(template: string, context: ShortcutContext): string {
  return template
    .replace(/\{\{cwd\}\}/g, context.cwd)
    .replace(/\{\{branchName\}\}/g, context.branchName)
    .replace(/\{\{taskTitle\}\}/g, escapeShellValue(context.taskTitle))
    .replace(/\{\{projectPath\}\}/g, context.projectPath);
}
