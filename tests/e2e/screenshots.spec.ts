import { test } from '@playwright/test';
import {
  launchApp,
  takeProductScreenshot,
  waitForBoard,
  createProject,
  createTask,
  createTempProject,
  cleanupTempProject,
} from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

const TEST_NAME = 'screenshots';
let app: ElectronApplication;
let page: Page;
let tmpDir: string;

test.beforeAll(async () => {
  tmpDir = createTempProject(TEST_NAME);
  const result = await launchApp();
  app = result.app;
  page = result.page;
  await createProject(page, 'Screenshot Project', tmpDir);
});

test.afterAll(async () => {
  await app?.close();
  cleanupTempProject(TEST_NAME);
});

test('capture board with tasks', async () => {
  await createTask(page, 'Design mockups', 'Create UI mockups for the new feature');
  await createTask(page, 'Implement backend', 'Build the API endpoints');
  await waitForBoard(page);
  await takeProductScreenshot(page, 'board-with-tasks');
});
