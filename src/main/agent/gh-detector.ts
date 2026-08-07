import which from 'which';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GhInfo {
  found: boolean;
  path: string | null;
  version: string | null;
}

export class GhDetector {
  private cached: GhInfo | null = null;

  async detect(): Promise<GhInfo> {
    if (this.cached) return this.cached;

    try {
      const ghPath = await which('gh');
      let version: string | null = null;
      try {
        const { stdout } = await execFileAsync(ghPath, ['--version'], {
          timeout: 5000,
        });
        // "gh version 2.62.0 (2024-11-14)" -> "2.62.0"
        const match = stdout.trim().match(/(\d+\.\d+\.\d+)/);
        version = match ? match[1] : null;
      } catch { /* version detection failed */ }

      this.cached = { found: true, path: ghPath, version };
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
