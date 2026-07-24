import { expect, test } from '@playwright/test';

import { openDemo } from './helpers';

async function settleDemo(page: Parameters<typeof openDemo>[0]) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  }));
}

test('Dashboardと遮蔽状態が画像baselineと一致する', async ({ page }) => {
  await openDemo(page);
  await page.locator('#hud').evaluate((element) => {
    (element as HTMLElement).style.display = 'none';
  });
  await expect(page.locator('#hud')).toBeHidden();
  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setAnimationTime(1.75);
    window.__HTML_SURFACE_DEMO__!.setOccluded(false);
  });
  await settleDemo(page);

  await expect(page).toHaveScreenshot(
    'monitor-dashboard.png',
    {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    },
  );

  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setOccluded(true);
  });
  await settleDemo(page);

  await expect(page).toHaveScreenshot(
    'monitor-occluded.png',
    {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    },
  );
});
