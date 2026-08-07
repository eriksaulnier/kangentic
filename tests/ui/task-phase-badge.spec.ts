/**
 * UI tests for the phase badge on task cards.
 *
 * The agent reports where it is in its loop via a session:phase push event.
 * The card renders that label next to the PR badge, and clears it when the
 * main process sends a null phase.
 */
import { test, expect } from '@playwright/test';
import { chromium, type Browser, type Page } from '@playwright/test';
import path from 'node:path';
import { waitForViteReady } from './helpers';

const MOCK_SCRIPT = path.join(__dirname, 'mock-electron-api.js');
const VITE_URL = `http://localhost:${process.env.PLAYWRIGHT_VITE_PORT || '5173'}`;

const PROJECT_ID = 'proj-phase-test';
const TASK_ID = 'task-phase-test';
const SESSION_ID = 'sess-phase-test';
const SWIMLANE_ID = 'lane-backlog';

const PRE_CONFIG = `
  window.__mockPreConfigure(function (state) {
    var ts = new Date().toISOString();

    state.projects.push({
      id: '${PROJECT_ID}',
      name: 'Phase Test',
      path: '/mock/phase-test',
      github_url: null,
      default_agent: 'claude',
      last_opened: ts,
      created_at: ts,
    });

    state.DEFAULT_SWIMLANES.forEach(function (s, i) {
      var id = i === 0 ? '${SWIMLANE_ID}' : state.uuid();
      state.swimlanes.push({
        id: id,
        name: s.name,
        role: s.role,
        color: s.color,
        icon: s.icon,
        is_archived: s.is_archived,
        permission_mode: s.permission_mode ?? null,
        auto_spawn: s.auto_spawn ?? false,
        position: i,
        created_at: ts,
      });
    });

    state.sessions.push({
      id: '${SESSION_ID}',
      taskId: '${TASK_ID}',
      projectId: '${PROJECT_ID}',
      pid: 9999,
      status: 'running',
      shell: 'bash',
      cwd: '/mock/phase-test',
      startedAt: ts,
      exitCode: null,
    });
    state.activityCache['${SESSION_ID}'] = 'thinking';

    state.tasks.push({
      id: '${TASK_ID}',
      title: 'Phase Badge Task',
      description: '',
      swimlane_id: '${SWIMLANE_ID}',
      position: 0,
      agent: null,
      session_id: '${SESSION_ID}',
      worktree_path: null,
      branch_name: null,
      pr_number: null,
      pr_url: null,
      base_branch: null,
      archived_at: null,
      created_at: ts,
      updated_at: ts,
    });

    return { currentProjectId: '${PROJECT_ID}' };
  });
`;

async function launch(): Promise<{ browser: Browser; page: Page }> {
  await waitForViteReady(VITE_URL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.addInitScript({ path: MOCK_SCRIPT });
  await page.addInitScript(PRE_CONFIG);

  await page.goto(VITE_URL);
  await page.waitForLoadState('load');
  await page.waitForSelector('text=Kangentic', { timeout: 15000 });

  return { browser, page };
}

test.describe('Task phase badge', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    ({ browser, page } = await launch());
    await page.locator('[data-swimlane-name="Backlog"]').waitFor({ state: 'visible', timeout: 15000 });
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('renders, updates, and clears the phase label', async () => {
    const card = page.locator(`[data-task-id="${TASK_ID}"]`);
    await expect(card).toBeVisible();

    const badge = card.locator('[data-testid="phase-badge"]');
    await expect(badge).not.toBeVisible();

    await page.evaluate(
      `window.__mockEmitPhase('${SESSION_ID}', { phase: 'review', detail: 'round 2 of 3' })`,
    );
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('review · round 2 of 3');

    await page.evaluate(`window.__mockEmitPhase('${SESSION_ID}', { phase: 'implement' })`);
    await expect(badge).toHaveText('implement');

    await page.evaluate(`window.__mockEmitPhase('${SESSION_ID}', null)`);
    await expect(badge).not.toBeVisible();
  });

  test('ignores phases pushed for another project', async () => {
    const badge = page.locator(`[data-task-id="${TASK_ID}"] [data-testid="phase-badge"]`);

    await page.evaluate(
      `window.__mockEmitPhase('${SESSION_ID}', { phase: 'verify' }, 'some-other-project')`,
    );
    await expect(badge).not.toBeVisible();
  });
});
