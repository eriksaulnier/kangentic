import simpleGit, { SimpleGit } from 'simple-git';
import path from 'node:path';
import fs from 'node:fs';

export class WorktreeManager {
  private git: SimpleGit;

  constructor(private projectPath: string) {
    this.git = simpleGit(projectPath);
  }

  async createWorktree(taskId: string, baseBranch: string = 'main', copyFiles: string[] = []): Promise<{ worktreePath: string; branchName: string }> {
    const branchName = `kanban/${taskId}`;
    const worktreePath = path.join(this.projectPath, '.worktrees', taskId);

    // Ensure .worktrees dir exists
    fs.mkdirSync(path.join(this.projectPath, '.worktrees'), { recursive: true });

    // Create worktree with a new branch
    await this.git.raw(['worktree', 'add', '-b', branchName, worktreePath, baseBranch]);

    // Copy specified files into the worktree
    for (const file of copyFiles) {
      const src = path.join(this.projectPath, file);
      const dest = path.join(worktreePath, file);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }

    return { worktreePath, branchName };
  }

  async removeWorktree(taskId: string): Promise<void> {
    const worktreePath = path.join(this.projectPath, '.worktrees', taskId);
    if (fs.existsSync(worktreePath)) {
      await this.git.raw(['worktree', 'remove', worktreePath, '--force']);
    }

    // Also try to delete the branch
    const branchName = `kanban/${taskId}`;
    try {
      await this.git.raw(['branch', '-D', branchName]);
    } catch { /* branch may not exist */ }
  }

  async listWorktrees(): Promise<string[]> {
    const result = await this.git.raw(['worktree', 'list', '--porcelain']);
    const worktrees: string[] = [];
    for (const line of result.split('\n')) {
      if (line.startsWith('worktree ')) {
        worktrees.push(line.replace('worktree ', ''));
      }
    }
    return worktrees;
  }
}
