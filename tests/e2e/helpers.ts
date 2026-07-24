import { expect, type Page } from '@playwright/test';

export async function openDemo(page: Page): Promise<void> {
  await page.goto('/?e2e=1');
  await page.waitForFunction(
    () => window.__HTML_SURFACE_DEMO__ !== undefined,
  );
  await page.evaluate(() => window.__HTML_SURFACE_DEMO__!.ready);
  await expect(page.locator('#loading')).toHaveCount(0);
}

export async function pointFor(
  page: Page,
  testId: string,
  xRatio?: number,
  yRatio?: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ target, x, y }) => (
      window.__HTML_SURFACE_DEMO__!.pointFor(target, x, y)
    ),
    {
      target: testId,
      x: xRatio,
      y: yRatio,
    },
  );
}

export async function clickSurfaceTarget(
  page: Page,
  testId: string,
): Promise<void> {
  const point = await pointFor(page, testId);
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
  await page.mouse.click(point.x, point.y);
}

export async function dragSurfaceTarget(
  page: Page,
  testId: string,
  fromRatio: number,
  toRatio: number,
): Promise<void> {
  const from = await pointFor(page, testId, fromRatio, 0.5);
  const to = await pointFor(page, testId, toRatio, 0.5);
  await page.mouse.move(from.x, from.y);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}
