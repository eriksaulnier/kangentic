import type { Task, Skill, SkillConfig, SwimlaneTransition } from '../../shared/types';
import { SessionManager } from '../pty/session-manager';
import { CommandBuilder } from '../agent/command-builder';
import { ClaudeDetector } from '../agent/claude-detector';
import type { SkillRepository } from '../db/repositories/skill-repository';
import type { TaskRepository } from '../db/repositories/task-repository';

export class TransitionEngine {
  constructor(
    private sessionManager: SessionManager,
    private skillRepo: SkillRepository,
    private taskRepo: TaskRepository,
    private claudeDetector: ClaudeDetector,
    private commandBuilder: CommandBuilder,
    private getConfig: () => { permissionMode: string; claudePath: string | null },
  ) {}

  async executeTransition(task: Task, fromSwimlaneId: string, toSwimlaneId: string): Promise<void> {
    const transitions = this.skillRepo.getTransitionsFor(fromSwimlaneId, toSwimlaneId);
    if (transitions.length === 0) return;

    for (const transition of transitions) {
      const skill = this.skillRepo.getById(transition.skill_id);
      if (!skill) continue;

      await this.executeSkill(skill, task);
    }
  }

  private async executeSkill(skill: Skill, task: Task): Promise<void> {
    const config: SkillConfig = JSON.parse(skill.config_json);
    const templateVars: Record<string, string> = {
      title: task.title,
      description: task.description,
      taskId: task.id,
      worktreePath: task.worktree_path || '',
      branchName: task.branch_name || '',
    };

    switch (skill.type) {
      case 'spawn_agent':
        await this.executeSpawnAgent(config, task, templateVars);
        break;

      case 'send_command':
        this.executeSendCommand(config, task, templateVars);
        break;

      case 'run_script':
        await this.executeRunScript(config, task, templateVars);
        break;

      case 'kill_session':
        this.executeKillSession(task);
        break;

      case 'webhook':
        await this.executeWebhook(config, templateVars);
        break;

      // create_worktree and cleanup_worktree are handled by GitManager
      // and invoked separately
    }
  }

  private async executeSpawnAgent(config: SkillConfig, task: Task, vars: Record<string, string>): Promise<void> {
    const appConfig = this.getConfig();
    const claude = await this.claudeDetector.detect(appConfig.claudePath);
    if (!claude.found || !claude.path) {
      throw new Error('Claude CLI not found on PATH');
    }

    const prompt = config.promptTemplate
      ? this.commandBuilder.interpolateTemplate(config.promptTemplate, vars)
      : `Task: ${task.title}\n\n${task.description}`;

    const permissionMode = config.permissionMode || appConfig.permissionMode;
    const command = this.commandBuilder.buildClaudeCommand({
      claudePath: claude.path,
      taskId: task.id,
      prompt,
      cwd: task.worktree_path || '',
      permissionMode: permissionMode as any,
    });

    const session = await this.sessionManager.spawn({
      taskId: task.id,
      command,
      cwd: task.worktree_path || process.cwd(),
    });

    this.taskRepo.update({
      id: task.id,
      session_id: session.id,
      agent: config.agent || 'claude',
    });
  }

  private executeSendCommand(config: SkillConfig, task: Task, vars: Record<string, string>): void {
    if (!task.session_id) return;
    const command = config.command
      ? this.commandBuilder.interpolateTemplate(config.command, vars)
      : '';
    if (command) {
      this.sessionManager.write(task.session_id, command + '\r');
    }
  }

  private async executeRunScript(config: SkillConfig, task: Task, vars: Record<string, string>): Promise<void> {
    const script = config.script
      ? this.commandBuilder.interpolateTemplate(config.script, vars)
      : '';
    if (!script) return;

    const cwd = config.workingDir === 'worktree' && task.worktree_path
      ? task.worktree_path
      : process.cwd();

    await this.sessionManager.spawn({
      taskId: task.id + '-script',
      command: script,
      cwd,
    });
  }

  private executeKillSession(task: Task): void {
    if (task.session_id) {
      this.sessionManager.kill(task.session_id);
      this.taskRepo.update({
        id: task.id,
        session_id: null,
      });
    }
  }

  private async executeWebhook(config: SkillConfig, vars: Record<string, string>): Promise<void> {
    if (!config.url) return;
    const url = this.commandBuilder.interpolateTemplate(config.url, vars);
    const body = config.body
      ? this.commandBuilder.interpolateTemplate(config.body, vars)
      : undefined;

    try {
      await fetch(url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body,
      });
    } catch (err) {
      console.error('Webhook failed:', err);
    }
  }
}
