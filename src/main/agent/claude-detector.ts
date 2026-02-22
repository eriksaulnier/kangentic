import which from 'which';
import { execSync } from 'node:child_process';

interface ClaudeInfo {
  found: boolean;
  path: string | null;
  version: string | null;
}

export class ClaudeDetector {
  private cached: ClaudeInfo | null = null;

  async detect(overridePath?: string | null): Promise<ClaudeInfo> {
    if (this.cached) return this.cached;

    try {
      const claudePath = overridePath || await which('claude');
      let version: string | null = null;
      try {
        version = execSync(`"${claudePath}" --version`, {
          timeout: 5000,
          encoding: 'utf-8',
        }).trim();
      } catch { /* version detection failed */ }

      this.cached = { found: true, path: claudePath, version };
      return this.cached;
    } catch {
      this.cached = { found: false, path: null, version: null };
      return this.cached;
    }
  }

  invalidateCache(): void {
    this.cached = null;
  }
}
