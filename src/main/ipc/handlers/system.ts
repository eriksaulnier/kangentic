import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { app, ipcMain, Notification, dialog, shell } from 'electron';
import { IPC } from '../../../shared/ipc-channels';
import { WorktreeManager, isGitRepo } from '../../git/worktree-manager';
import { resolveClaudeConfigDir } from '../../agent/claude-env';
import { deepMergeConfig } from '../../../shared/object-utils';
import { switchGitignoreScope } from '../helpers';
import type { AppConfig, NotificationInput, ClaudeCommand } from '../../../shared/types';
import type { IpcContext } from '../ipc-context';

/** Trigger gitignore scope switchover if the scope changed between config saves. */
function applyGitignoreScopeChange(
  context: IpcContext,
  projectPath: string,
  previousConfig: AppConfig,
  newConfig: AppConfig,
): void {
  if (previousConfig.git.gitignoreScope === newConfig.git.gitignoreScope) return;
  const otherProjects = context.projectRepo.list().filter((p) => p.path !== projectPath);
  const otherUsesUserScope = otherProjects.some((p) => {
    const projectOverrides = context.configManager.loadProjectOverrides(p.path);
    return projectOverrides?.git?.gitignoreScope === 'user';
  });
  switchGitignoreScope(projectPath, newConfig.git.gitignoreScope, otherUsesUserScope);
}

export function registerSystemHandlers(context: IpcContext): void {
  // === App ===
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion());

  // === Config ===
  ipcMain.handle(IPC.CONFIG_GET, () => {
    const config = context.configManager.getEffectiveConfig(context.currentProjectPath || undefined);
    // Overlay board config's defaultBaseBranch (team-shared) onto the effective config.
    // Spread to avoid mutating the cached config object from ConfigManager.
    const boardDefaultBranch = context.boardConfigManager.getDefaultBaseBranch();
    if (boardDefaultBranch) {
      return { ...config, git: { ...config.git, defaultBaseBranch: boardDefaultBranch } };
    }
    return config;
  });
  ipcMain.handle(IPC.CONFIG_GET_GLOBAL, () => context.configManager.load());

  ipcMain.handle(IPC.CONFIG_SET, (_, config) => {
    context.configManager.save(config);
    // Apply runtime changes
    const effective = context.configManager.getEffectiveConfig(context.currentProjectPath || undefined);
    context.sessionManager.setMaxConcurrent(effective.claude.maxConcurrentSessions);
    context.sessionManager.setShell(effective.terminal.shell);
    context.sessionManager.setIdleTimeout(effective.claude.idleTimeoutMinutes);
  });

  ipcMain.handle(IPC.CONFIG_GET_PROJECT, () => {
    if (!context.currentProjectPath) return null;
    return context.configManager.loadProjectOverrides(context.currentProjectPath);
  });

  ipcMain.handle(IPC.CONFIG_SET_PROJECT, (_, overrides) => {
    if (!context.currentProjectPath) throw new Error('No project open');
    const previousConfig = context.configManager.getEffectiveConfig(context.currentProjectPath);
    context.configManager.saveProjectOverrides(context.currentProjectPath, overrides);
    const newConfig = context.configManager.getEffectiveConfig(context.currentProjectPath);
    applyGitignoreScopeChange(context, context.currentProjectPath, previousConfig, newConfig);
  });

  ipcMain.handle(IPC.CONFIG_GET_PROJECT_BY_PATH, (_, projectPath: string) => {
    const known = context.projectRepo.list().some((p) => p.path === projectPath);
    if (!known) throw new Error('Unknown project path');
    return context.configManager.loadProjectOverrides(projectPath);
  });

  ipcMain.handle(IPC.CONFIG_SET_PROJECT_BY_PATH, (_, projectPath: string, overrides) => {
    const known = context.projectRepo.list().some((p) => p.path === projectPath);
    if (!known) throw new Error('Unknown project path');
    const previousConfig = context.configManager.getEffectiveConfig(projectPath);
    context.configManager.saveProjectOverrides(projectPath, overrides);
    const newConfig = context.configManager.getEffectiveConfig(projectPath);
    applyGitignoreScopeChange(context, projectPath, previousConfig, newConfig);
  });

  ipcMain.handle(IPC.CONFIG_SYNC_DEFAULT_TO_PROJECTS, (_, partial) => {
    const projects = context.projectRepo.list();
    let updatedCount = 0;
    for (const project of projects) {
      const existing = context.configManager.loadProjectOverrides(project.path) || {};
      const merged = deepMergeConfig(existing, partial);
      context.configManager.saveProjectOverrides(project.path, merged);
      updatedCount++;
    }
    return updatedCount;
  });

  // === Claude ===
  ipcMain.handle(IPC.CLAUDE_DETECT, () => {
    const config = context.configManager.load();
    return context.claudeDetector.detect(config.claude.cliPath);
  });

  ipcMain.handle(IPC.CLAUDE_LIST_COMMANDS, (_, cwd?: string): ClaudeCommand[] => {
    const projectPath = context.currentProjectPath;
    if (!projectPath) return [];

    const homeDir = app.getPath('home');
    const startDir = path.resolve(cwd || projectPath);

    // Collect candidate Claude config roots from cwd upward, similar to how
    // Claude Code discovers commands. Closest dirs first so nearer entries
    // win on dedup. The walk stops below the home directory: user-level
    // entries come from the active config dir, which is not ~/.claude under
    // a profile, and reaching ~/.claude here would shadow it.
    const commandRoots: string[] = [];
    let current = startDir;
    const filesystemRoot = path.parse(current).root;
    while (current !== filesystemRoot && current !== homeDir) {
      commandRoots.push(path.join(current, '.claude'));
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    // User-level entries live under the active Claude config dir, which is
    // ~/.claude only when no profile is configured.
    const effectiveConfig = context.configManager.getEffectiveConfig(projectPath);
    const userRoot = resolveClaudeConfigDir(effectiveConfig.claude.configDir)
      ?? path.join(homeDir, '.claude');
    commandRoots.push(userRoot);

    // Skills, unlike commands, are not discovered by walking up the tree --
    // Claude Code reads them from the project root and the user config dir only.
    const skillRoots = [path.join(startDir, '.claude'), userRoot];

    const seen = new Set<string>(); // command names already collected (closest wins)
    const commands: ClaudeCommand[] = [];

    function readFrontmatter(filePath: string): { description: string; argumentHint: string } {
      let description = '';
      let argumentHint = '';
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.startsWith('---')) {
          const endIndex = content.indexOf('---', 3);
          if (endIndex !== -1) {
            const frontmatter = content.slice(3, endIndex);
            for (const line of frontmatter.split('\n')) {
              const trimmed = line.trim();
              if (trimmed.startsWith('description:')) {
                description = trimmed.slice('description:'.length).trim().replace(/^['"]|['"]$/g, '');
              } else if (trimmed.startsWith('argument-hint:')) {
                argumentHint = trimmed.slice('argument-hint:'.length).trim().replace(/^['"]|['"]$/g, '');
              }
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
      return { description, argumentHint };
    }

    function walkCommands(directory: string, prefix: string): void {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walkCommands(fullPath, prefix ? `${prefix}${entry.name}:` : `${entry.name}:`);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const baseName = entry.name.slice(0, -3);
          const commandName = prefix + baseName;
          if (seen.has(commandName)) continue; // closer directory already provided this command
          seen.add(commandName);

          const { description, argumentHint } = readFrontmatter(fullPath);
          commands.push({ name: commandName, displayName: `/${commandName}`, description, argumentHint });
        }
      }
    }

    /** Collect `skills/<name>/SKILL.md` entries -- the directory name is the command name. */
    function walkSkills(directory: string): void {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        // Skill directories are commonly symlinks, for which isDirectory() is
        // false -- probing SKILL.md covers both real dirs and symlinks.
        const skillFile = path.join(directory, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillFile)) continue;
        if (seen.has(entry.name)) continue;
        seen.add(entry.name);

        const { description, argumentHint } = readFrontmatter(skillFile);
        commands.push({ name: entry.name, displayName: `/${entry.name}`, description, argumentHint });
      }
    }

    for (const claudeRoot of commandRoots) {
      walkCommands(path.join(claudeRoot, 'commands'), '');
    }
    for (const claudeRoot of skillRoots) {
      walkSkills(path.join(claudeRoot, 'skills'));
    }

    commands.sort((a, b) => a.name.localeCompare(b.name));
    return commands;
  });

  // === Shell ===
  ipcMain.handle(IPC.SHELL_GET_AVAILABLE, () => context.shellResolver.getAvailableShells());
  ipcMain.handle(IPC.SHELL_GET_DEFAULT, () => context.shellResolver.getDefaultShell());
  ipcMain.handle(IPC.SHELL_OPEN_PATH, (_, dirPath: string) => shell.openPath(dirPath));
  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_, url: string) => shell.openExternal(url));

  ipcMain.handle(IPC.SHELL_EXEC, (_, command: string, cwd: string) => {
    if (!command || typeof command !== 'string' || !command.trim()) {
      throw new Error('shell:exec requires a non-empty command string');
    }
    if (!cwd || typeof cwd !== 'string' || !fs.existsSync(cwd)) {
      throw new Error(`shell:exec requires a valid cwd directory (got "${cwd}")`);
    }
    console.log(`[shell:exec] command="${command}" cwd="${cwd}"`);
    const child = spawn(command, [], {
      cwd,
      shell: true,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();
    return { pid: child.pid };
  });

  // === Git ===
  ipcMain.handle(IPC.GIT_DETECT, () => context.gitDetector.detect());

  ipcMain.handle(IPC.GIT_LIST_BRANCHES, async () => {
    if (!context.currentProjectPath || !isGitRepo(context.currentProjectPath)) return [];
    try {
      const worktreeManager = new WorktreeManager(context.currentProjectPath);
      return await worktreeManager.listRemoteBranches();
    } catch { return []; }
  });

  // === Dialog ===
  ipcMain.handle(IPC.DIALOG_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog(context.mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // === Window ===
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => context.mainWindow.minimize());
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (context.mainWindow.isMaximized()) {
      context.mainWindow.unmaximize();
    } else {
      context.mainWindow.maximize();
    }
  });
  ipcMain.on(IPC.WINDOW_CLOSE, () => context.mainWindow.close());
  ipcMain.on(IPC.WINDOW_FLASH_FRAME, (_event, flash: boolean) => context.mainWindow.flashFrame(flash));
  ipcMain.handle(IPC.WINDOW_IS_FOCUSED, () => context.mainWindow.isFocused());

  // === Notifications ===
  const activeNotifications = new Set<Notification>();

  ipcMain.on(IPC.NOTIFICATION_SHOW, (_event, input: NotificationInput) => {
    if (!Notification.isSupported()) {
      console.warn('[NOTIFICATION] Notifications not supported on this system');
      return;
    }

    const notification = new Notification({
      title: input.title,
      body: input.body,
    });

    activeNotifications.add(notification);

    const cleanup = () => {
      activeNotifications.delete(notification);
    };

    notification.on('click', () => {
      cleanup();

      const mainWindow = context.mainWindow;
      if (mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();

      const sendClickEvent = () => {
        mainWindow.webContents.send(IPC.NOTIFICATION_CLICKED, input.projectId, input.taskId);
      };

      if (mainWindow.isFocused()) {
        sendClickEvent();
      } else {
        mainWindow.once('focus', sendClickEvent);
      }
    });

    notification.on('close', cleanup);

    notification.show();
  });
}
