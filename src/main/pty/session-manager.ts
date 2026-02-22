import * as pty from 'node-pty';
import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import { ShellResolver } from './shell-resolver';
import type { Session, SessionStatus, SpawnSessionInput } from '../../shared/types';

interface ManagedSession {
  id: string;
  taskId: string;
  pty: pty.IPty | null;
  status: SessionStatus;
  shell: string;
  cwd: string;
  startedAt: string;
  exitCode: number | null;
  buffer: string;
  flushScheduled: boolean;
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, ManagedSession>();
  private queue: Array<{ input: SpawnSessionInput; resolve: (session: Session) => void }> = [];
  private maxConcurrent = 5;
  private shellResolver = new ShellResolver();
  private configuredShell: string | null = null;

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.processQueue();
  }

  setShell(shell: string | null): void {
    this.configuredShell = shell;
  }

  private get activeCount(): number {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.status === 'running') count++;
    }
    return count;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  async spawn(input: SpawnSessionInput): Promise<Session> {
    if (this.activeCount >= this.maxConcurrent) {
      // Queue it
      return new Promise((resolve) => {
        this.queue.push({ input, resolve });
        // Create a placeholder session
        const id = uuidv4();
        const session: ManagedSession = {
          id,
          taskId: input.taskId,
          pty: null,
          status: 'queued',
          shell: '',
          cwd: input.cwd,
          startedAt: new Date().toISOString(),
          exitCode: null,
          buffer: '',
          flushScheduled: false,
        };
        this.sessions.set(id, session);
        this.emit('status', id, 'queued');
      });
    }

    return this.doSpawn(input);
  }

  private async doSpawn(input: SpawnSessionInput): Promise<Session> {
    const shell = this.configuredShell || await this.shellResolver.getDefaultShell();
    const id = input.taskId ? (this.findByTaskId(input.taskId)?.id || uuidv4()) : uuidv4();

    // Determine shell args based on shell type
    const shellName = shell.toLowerCase();
    let shellArgs: string[];
    if (shellName.includes('cmd')) {
      shellArgs = [];
    } else if (shellName.includes('powershell') || shellName.includes('pwsh')) {
      shellArgs = ['-NoLogo'];
    } else {
      shellArgs = ['--login'];
    }

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: input.cwd,
      env: { ...process.env, ...input.env } as Record<string, string>,
    });

    const session: ManagedSession = {
      id,
      taskId: input.taskId,
      pty: ptyProcess,
      status: 'running',
      shell,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      exitCode: null,
      buffer: '',
      flushScheduled: false,
    };

    // Remove any queued placeholder
    const existing = this.sessions.get(id);
    this.sessions.set(id, session);

    // Batched data output (~60fps)
    ptyProcess.onData((data: string) => {
      session.buffer += data;
      if (!session.flushScheduled) {
        session.flushScheduled = true;
        setTimeout(() => {
          if (session.buffer) {
            this.emit('data', id, session.buffer);
            session.buffer = '';
          }
          session.flushScheduled = false;
        }, 16);
      }
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      session.status = 'exited';
      session.exitCode = exitCode;
      session.pty = null;
      this.emit('exit', id, exitCode);
      this.processQueue();
    });

    this.emit('status', id, 'running');

    // If there's a command to run, send it after a brief delay
    if (input.command) {
      setTimeout(() => {
        ptyProcess.write(input.command + '\r');
      }, 100);
    }

    return this.toSession(session);
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.pty) {
      session.pty.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session?.pty) {
      session.pty.resize(cols, rows);
    }
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.pty) {
      session.pty.kill();
    }
    // Also remove from queue
    const queueIdx = this.queue.findIndex(q => {
      const s = this.findByTaskId(q.input.taskId);
      return s?.id === sessionId;
    });
    if (queueIdx >= 0) {
      this.queue.splice(queueIdx, 1);
      if (session) {
        session.status = 'exited';
        session.exitCode = -1;
      }
    }
  }

  getSession(sessionId: string): Session | undefined {
    const s = this.sessions.get(sessionId);
    return s ? this.toSession(s) : undefined;
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values()).map(s => this.toSession(s));
  }

  private findByTaskId(taskId: string): ManagedSession | undefined {
    for (const s of this.sessions.values()) {
      if (s.taskId === taskId) return s;
    }
    return undefined;
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) {
        const session = await this.doSpawn(next.input);
        next.resolve(session);
      }
    }
  }

  private toSession(s: ManagedSession): Session {
    return {
      id: s.id,
      taskId: s.taskId,
      pid: s.pty?.pid ?? null,
      status: s.status,
      shell: s.shell,
      cwd: s.cwd,
      startedAt: s.startedAt,
      exitCode: s.exitCode,
    };
  }

  killAll(): void {
    for (const session of this.sessions.values()) {
      if (session.pty) {
        session.pty.kill();
      }
    }
    this.sessions.clear();
    this.queue.length = 0;
  }
}
