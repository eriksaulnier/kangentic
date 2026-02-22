import { test, expect } from '@playwright/test';
import { launchApp, takeProductScreenshot } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const result = await launchApp();
  app = result.app;
  page = result.page;
});

test.afterAll(async () => {
  await app?.close();
});

test.describe('App Launch', () => {
  test('window opens with correct title', async () => {
    const title = await page.title();
    expect(title).toBe('Kangentic');
  });

  test('shows empty state when no project selected', async () => {
    const emptyState = page.locator('text=Select or create a project');
    await expect(emptyState).toBeVisible();
  });

  test('title bar displays Kangentic branding', async () => {
    const titleBar = page.locator('text=Kangentic');
    await expect(titleBar).toBeVisible();
  });

  test('sidebar shows Projects header', async () => {
    const header = page.locator('text=Projects');
    await expect(header).toBeVisible();
  });

  test('status bar shows session count', async () => {
    const statusBar = page.locator('text=sessions');
    await expect(statusBar).toBeVisible();
  });
});

test.describe('Project Management', () => {
  test('can open new project form', async () => {
    const addButton = page.locator('button[title="New project"]');
    await addButton.click();

    const nameInput = page.locator('input[placeholder="Project name"]');
    await expect(nameInput).toBeVisible();
  });

  test('can create a project', async () => {
    const nameInput = page.locator('input[placeholder="Project name"]');
    const pathInput = page.locator('input[placeholder="Project path"]');

    await nameInput.fill('Test Project');
    await pathInput.fill('C:\\temp\\test-project');

    const createButton = page.locator('button:has-text("Create")');
    await createButton.click();

    // Board should now be visible
    await page.waitForTimeout(500);
    const addTaskButton = page.locator('text=+ Add task');
    await expect(addTaskButton.first()).toBeVisible();
  });
});

test.describe('Kanban Board', () => {
  test('default swimlanes are created', async () => {
    const backlog = page.locator('text=Backlog');
    const planning = page.locator('text=Planning');
    const running = page.locator('text=Running');
    const review = page.locator('text=Review');
    const done = page.locator('text=Done');

    await expect(backlog).toBeVisible();
    await expect(planning).toBeVisible();
    await expect(running).toBeVisible();
    await expect(review).toBeVisible();
    await expect(done).toBeVisible();
  });

  test('can create a task', async () => {
    const addButton = page.locator('text=+ Add task').first();
    await addButton.click();

    const titleInput = page.locator('input[placeholder="Task title"]');
    await titleInput.fill('Implement feature X');

    const descInput = page.locator('textarea[placeholder="Description (optional)"]');
    await descInput.fill('Build the new feature with tests');

    const createButton = page.locator('button:has-text("Create")');
    await createButton.click();

    await page.waitForTimeout(300);
    const taskCard = page.locator('text=Implement feature X');
    await expect(taskCard).toBeVisible();
  });
});

test.describe('Screenshots', () => {
  test('capture empty state', async () => {
    await takeProductScreenshot(page, '01-empty-state');
  });

  test('capture board with tasks', async () => {
    await takeProductScreenshot(page, '02-board-with-tasks');
  });

  test('capture settings page', async () => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await page.waitForTimeout(300);

    await takeProductScreenshot(page, '03-settings-page');

    // Go back
    const backButton = page.locator('text=Back');
    await backButton.click();
  });
});
