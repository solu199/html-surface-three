import { expect, test } from '@playwright/test';

import {
  clickSurfaceTarget,
  openDemo,
  pointFor,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('polyfill経路で表示・button・input・scrollが動作する', async ({
  page,
}) => {
  const state = await page.evaluate(
    () => window.__HTML_SURFACE_DEMO__!.getState(),
  );
  expect(state.capabilities.backend.active).toBe('polyfill');

  await clickSurfaceTarget(page, 'react-action');
  await expect(page.getByTestId('action-count')).toHaveText('1');

  await clickSurfaceTarget(page, 'react-input');
  await page.keyboard.type('smoke');
  await expect(page.getByTestId('react-input')).toHaveValue('smoke');

  await clickSurfaceTarget(page, 'nav-activity');
  const scrollPoint = await pointFor(page, 'react-scroll');
  await page.mouse.move(scrollPoint.x, scrollPoint.y);
  await page.mouse.wheel(0, 180);
  await expect.poll(
    () => page.getByTestId('react-scroll').evaluate(
      (element) => element.scrollTop,
    ),
  ).toBeGreaterThan(0);
});
