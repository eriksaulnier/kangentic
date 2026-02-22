import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../.vite/build/main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  return { app, page };
}

export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const screenshotPath = path.join(__dirname, '../screenshots', `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

export async function takeProductScreenshot(
  page: Page,
  name: string,
  options?: { width?: number; height?: number },
): Promise<string> {
  const width = options?.width || 1400;
  const height = options?.height || 900;

  const window = await page.evaluate(() => {
    return { width: window.innerWidth, height: window.innerHeight };
  });

  // Resize if needed
  if (window.width !== width || window.height !== height) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(500);
  }

  return takeScreenshot(page, name);
}
