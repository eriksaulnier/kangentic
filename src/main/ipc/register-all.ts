import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type Database from 'better-sqlite3';
import { ProjectRepository } from '../db/repositories/project-repository';
import { TaskRepository } from '../db/repositories/task-repository';
import { SwimlaneRepository } from '../db/repositories/swimlane-repository';
import { SkillRepository } from '../db/repositories/skill-repository';
import { SessionManager } from '../pty/session-manager';
import { ConfigManager } from '../config/config-manager';
import { ClaudeDetector } from '../agent/claude-detector';
import { ShellResolver } from '../pty/shell-resolver';
import { TransitionEngine } from '../engine/transition-engine';
import { CommandBuilder } from '../agent/command-builder';
import { getProjectDb } from '../db/database';

let currentProjectId: string | null = null;
let currentProjectPath: string | null = null;

// Singleton services
const projectRepo = new ProjectRepository();
const sessionManager = new SessionManager();
const configManager = new ConfigManager();
const claudeDetector = new ClaudeDetector();
const shellResolver = new ShellResolver();
const commandBuilder = new CommandBuilder();

function getProjectRepos(): { tasks: TaskRepository; swimlanes: SwimlaneRepository; skills: SkillRepository } {
  if (!currentProjectId) throw new Error('No project is currently open');
  const db = getProjectDb(currentProjectId);
  return {
    tasks: new TaskRepository(db),
    swimlanes: new SwimlaneRepository(db),
    skills: new SkillRepository(db),
  };
}

export function registerAllIpc(mainWindow: BrowserWindow): void {
  // === Projects ===
  ipcMain.handle(IPC.PROJECT_LIST, () => projectRepo.list());

  ipcMain.handle(IPC.PROJECT_CREATE, (_, input) => {
    const project = projectRepo.create(input);
    // Initialize the project database (creates tables + default swimlanes)
    getProjectDb(project.id);
    return project;
  });

  ipcMain.handle(IPC.PROJECT_DELETE, (_, id) => projectRepo.delete(id));

  ipcMain.handle(IPC.PROJECT_OPEN, (_, id) => {
    const project = projectRepo.getById(id);
    if (!project) throw new Error(`Project ${id} not found`);
    currentProjectId = id;
    currentProjectPath = project.path;
    projectRepo.updateLastOpened(id);

    // Apply project config overrides
    const config = configManager.getEffectiveConfig(project.path);
    sessionManager.setMaxConcurrent(config.claude.maxConcurrentSessions);
    sessionManager.setShell(config.terminal.shell);
  });

  ipcMain.handle(IPC.PROJECT_GET_CURRENT, () => {
    if (!currentProjectId) return null;
    return projectRepo.getById(currentProjectId) || null;
  });

  // === Tasks ===
  ipcMain.handle(IPC.TASK_LIST, (_, swimlaneId?) => {
    const { tasks } = getProjectRepos();
    return tasks.list(swimlaneId);
  });

  ipcMain.handle(IPC.TASK_CREATE, (_, input) => {
    const { tasks } = getProjectRepos();
    return tasks.create(input);
  });

  ipcMain.handle(IPC.TASK_UPDATE, (_, input) => {
    const { tasks } = getProjectRepos();
    return tasks.update(input);
  });

  ipcMain.handle(IPC.TASK_DELETE, (_, id) => {
    const { tasks } = getProjectRepos();
    tasks.delete(id);
  });

  ipcMain.handle(IPC.TASK_MOVE, async (_, input) => {
    const { tasks, skills } = getProjectRepos();
    const task = tasks.getById(input.taskId);
    if (!task) throw new Error(`Task ${input.taskId} not found`);

    const fromSwimlaneId = task.swimlane_id;

    // Move the task in the database
    tasks.move(input);

    // Execute transition skills
    const engine = new TransitionEngine(
      sessionManager,
      skills,
      tasks,
      claudeDetector,
      commandBuilder,
      () => {
        const config = configManager.getEffectiveConfig(currentProjectPath || undefined);
        return {
          permissionMode: config.claude.permissionMode,
          claudePath: config.claude.cliPath,
        };
      },
    );

    try {
      await engine.executeTransition(task, fromSwimlaneId, input.targetSwimlaneId);
    } catch (err) {
      console.error('Transition engine error:', err);
    }
  });

  // === Swimlanes ===
  ipcMain.handle(IPC.SWIMLANE_LIST, () => {
    const { swimlanes } = getProjectRepos();
    return swimlanes.list();
  });

  ipcMain.handle(IPC.SWIMLANE_CREATE, (_, input) => {
    const { swimlanes } = getProjectRepos();
    return swimlanes.create(input);
  });

  ipcMain.handle(IPC.SWIMLANE_UPDATE, (_, input) => {
    const { swimlanes } = getProjectRepos();
    return swimlanes.update(input);
  });

  ipcMain.handle(IPC.SWIMLANE_DELETE, (_, id) => {
    const { swimlanes } = getProjectRepos();
    swimlanes.delete(id);
  });

  ipcMain.handle(IPC.SWIMLANE_REORDER, (_, ids) => {
    const { swimlanes } = getProjectRepos();
    swimlanes.reorder(ids);
  });

  // === Skills ===
  ipcMain.handle(IPC.SKILL_LIST, () => {
    const { skills } = getProjectRepos();
    return skills.list();
  });

  ipcMain.handle(IPC.SKILL_CREATE, (_, input) => {
    const { skills } = getProjectRepos();
    return skills.create(input);
  });

  ipcMain.handle(IPC.SKILL_UPDATE, (_, input) => {
    const { skills } = getProjectRepos();
    return skills.update(input);
  });

  ipcMain.handle(IPC.SKILL_DELETE, (_, id) => {
    const { skills } = getProjectRepos();
    skills.delete(id);
  });

  // === Transitions ===
  ipcMain.handle(IPC.TRANSITION_LIST, () => {
    const { skills } = getProjectRepos();
    return skills.listTransitions();
  });

  ipcMain.handle(IPC.TRANSITION_SET, (_, fromId, toId, skillIds) => {
    const { skills } = getProjectRepos();
    skills.setTransitions(fromId, toId, skillIds);
  });

  ipcMain.handle(IPC.TRANSITION_GET_FOR, (_, fromId, toId) => {
    const { skills } = getProjectRepos();
    return skills.getTransitionsFor(fromId, toId);
  });

  // === Sessions ===
  ipcMain.handle(IPC.SESSION_SPAWN, (_, input) => sessionManager.spawn(input));
  ipcMain.handle(IPC.SESSION_KILL, (_, id) => sessionManager.kill(id));
  ipcMain.handle(IPC.SESSION_WRITE, (_, id, data) => sessionManager.write(id, data));
  ipcMain.handle(IPC.SESSION_RESIZE, (_, id, cols, rows) => sessionManager.resize(id, cols, rows));
  ipcMain.handle(IPC.SESSION_LIST, () => sessionManager.listSessions());

  // Forward PTY events to renderer
  sessionManager.on('data', (sessionId: string, data: string) => {
    mainWindow.webContents.send(IPC.SESSION_DATA, sessionId, data);
  });

  sessionManager.on('exit', (sessionId: string, exitCode: number) => {
    mainWindow.webContents.send(IPC.SESSION_EXIT, sessionId, exitCode);
  });

  // === Config ===
  ipcMain.handle(IPC.CONFIG_GET, () => configManager.load());

  ipcMain.handle(IPC.CONFIG_SET, (_, config) => {
    configManager.save(config);
    // Apply runtime changes
    const effective = configManager.getEffectiveConfig(currentProjectPath || undefined);
    sessionManager.setMaxConcurrent(effective.claude.maxConcurrentSessions);
    sessionManager.setShell(effective.terminal.shell);
  });

  ipcMain.handle(IPC.CONFIG_GET_PROJECT, () => {
    if (!currentProjectPath) return null;
    return configManager.loadProjectOverrides(currentProjectPath);
  });

  ipcMain.handle(IPC.CONFIG_SET_PROJECT, (_, overrides) => {
    if (!currentProjectPath) throw new Error('No project open');
    configManager.saveProjectOverrides(currentProjectPath, overrides);
  });

  // === Claude ===
  ipcMain.handle(IPC.CLAUDE_DETECT, () => {
    const config = configManager.load();
    return claudeDetector.detect(config.claude.cliPath);
  });

  // === Shell ===
  ipcMain.handle(IPC.SHELL_GET_AVAILABLE, () => shellResolver.getAvailableShells());
  ipcMain.handle(IPC.SHELL_GET_DEFAULT, () => shellResolver.getDefaultShell());

  // === Window ===
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow.minimize());
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow.close());
}

export function getSessionManager(): SessionManager {
  return sessionManager;
}
