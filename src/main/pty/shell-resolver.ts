import which from 'which';
import os from 'node:os';

interface ShellInfo {
  name: string;
  path: string;
}

export class ShellResolver {
  async getAvailableShells(): Promise<ShellInfo[]> {
    const shells: ShellInfo[] = [];
    const platform = process.platform;

    if (platform === 'win32') {
      const candidates = [
        { name: 'PowerShell 7', cmd: 'pwsh' },
        { name: 'PowerShell 5', cmd: 'powershell' },
        { name: 'Git Bash', cmd: 'bash' },
        { name: 'Command Prompt', cmd: 'cmd' },
      ];
      for (const c of candidates) {
        try {
          const resolved = await which(c.cmd);
          shells.push({ name: c.name, path: resolved });
        } catch { /* not found */ }
      }
    } else {
      const candidates = ['zsh', 'bash', 'fish', 'sh'];
      for (const cmd of candidates) {
        try {
          const resolved = await which(cmd);
          shells.push({ name: cmd, path: resolved });
        } catch { /* not found */ }
      }
    }

    return shells;
  }

  async getDefaultShell(): Promise<string> {
    const platform = process.platform;

    if (platform === 'win32') {
      // Prefer pwsh > powershell > bash > cmd
      for (const cmd of ['pwsh', 'powershell', 'bash', 'cmd']) {
        try {
          return await which(cmd);
        } catch { /* not found */ }
      }
      return 'cmd.exe';
    }

    // Unix: use $SHELL
    const envShell = process.env.SHELL;
    if (envShell) return envShell;

    // Fallback
    try {
      return await which('bash');
    } catch {
      return '/bin/sh';
    }
  }
}
