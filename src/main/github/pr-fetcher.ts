import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GhDetector } from '../agent/gh-detector';
import type { PullRequestInfo } from '../../shared/types';

const execFileAsync = promisify(execFile);

const PR_FIELDS = 'number,title,url,author,headRefName,baseRefName,additions,deletions';

/**
 * Fetch metadata for a pull request via the `gh` CLI.
 *
 * `ref` is a PR number, a `#123` string, or a full PR URL. Runs with `cwd` set
 * to the project so `gh` infers the repo from its remote; a URL overrides that
 * and works across repos.
 *
 * Throws with the reason `gh` gave -- not authenticated, not a repo, no such
 * PR -- because the dialog has nothing else to show the user.
 */
export async function fetchPullRequest(
  ghDetector: GhDetector,
  projectPath: string,
  ref: string,
): Promise<PullRequestInfo> {
  const trimmedRef = ref.trim().replace(/^#/, '');
  if (!trimmedRef) throw new Error('Enter a PR number or URL');

  const gh = await ghDetector.detect();
  if (!gh.found || !gh.path) {
    throw new Error('GitHub CLI (gh) not found on PATH. Install it to create tasks from pull requests.');
  }

  let stdout: string;
  try {
    // The ref goes after `--` so gh reads it as positional. A pasted value
    // starting with `-` would otherwise parse as a flag (`-R` becomes --repo).
    ({ stdout } = await execFileAsync(gh.path, ['pr', 'view', '--json', PR_FIELDS, '--', trimmedRef], {
      cwd: projectPath,
      timeout: 20_000,
    }));
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(stderr || `Could not fetch PR ${trimmedRef}: ${(error as Error).message}`);
  }

  let parsed: {
    number?: number;
    title?: string;
    url?: string;
    author?: { login?: string };
    headRefName?: string;
    baseRefName?: string;
    additions?: number;
    deletions?: number;
  };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`gh returned output that is not JSON for PR ${trimmedRef}`);
  }

  if (typeof parsed.number !== 'number' || !parsed.url) {
    throw new Error(`gh returned no PR for "${trimmedRef}"`);
  }

  return {
    number: parsed.number,
    title: parsed.title ?? '',
    url: parsed.url,
    author: parsed.author?.login ?? '',
    headRefName: parsed.headRefName ?? '',
    baseRefName: parsed.baseRefName ?? '',
    additions: parsed.additions ?? 0,
    deletions: parsed.deletions ?? 0,
  };
}
