import { expect, test } from '@playwright/test';

import {
  clickSurfaceTarget,
  dragSurfaceTarget,
  openDemo,
  pointFor,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('移動・回転後もReactのbuttonとnavigationを操作できる', async ({
  page,
}) => {
  await clickSurfaceTarget(page, 'react-action');
  await expect(page.getByTestId('action-count')).toHaveText('1');

  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setAnimationTime(3.25);
  });
  await clickSurfaceTarget(page, 'react-action');
  await expect(page.getByTestId('action-count')).toHaveText('2');

  await clickSurfaceTarget(page, 'nav-settings');
  await expect(page.locator('.monitor-site')).toHaveAttribute(
    'data-page',
    'settings',
  );
});

test('keyboard・checkbox・range drag・scrollを操作できる', async ({
  page,
}) => {
  await clickSurfaceTarget(page, 'react-input');
  await page.keyboard.type('alpha-7');
  await expect(page.getByTestId('react-input')).toHaveValue('alpha-7');

  await clickSurfaceTarget(page, 'nav-settings');
  await clickSurfaceTarget(page, 'react-checkbox');
  await expect(page.getByTestId('react-checkbox')).not.toBeChecked();

  await dragSurfaceTarget(page, 'react-range', 0.2, 0.82);
  await expect(page.getByTestId('range-value')).not.toHaveText('42');

  await clickSurfaceTarget(page, 'nav-activity');
  const scrollPoint = await pointFor(page, 'react-scroll');
  const before = await page.getByTestId('react-scroll').evaluate(
    (element) => element.scrollTop,
  );
  await page.mouse.move(scrollPoint.x, scrollPoint.y);
  await page.mouse.wheel(0, 260);
  await expect.poll(
    () => page.getByTestId('react-scroll').evaluate(
      (element) => element.scrollTop,
    ),
  ).toBeGreaterThan(before);
});

test('composition eventと複数Surfaceを処理できる', async ({ page }) => {
  await clickSurfaceTarget(page, 'react-input');
  await page.getByTestId('react-input').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.dispatchEvent(new CompositionEvent('compositionstart', {
      bubbles: true,
      data: '',
    }));
    input.dispatchEvent(new CompositionEvent('compositionupdate', {
      bubbles: true,
      data: '日本語',
    }));
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, '日本語');
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: '日本語',
      inputType: 'insertCompositionText',
    }));
    input.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: '日本語',
    }));
  });
  await expect(page.getByTestId('react-input')).toHaveValue('日本語');

  await clickSurfaceTarget(page, 'vanilla-action');
  await expect(page.locator('[data-occluder-state]')).toHaveText('held');
});

test('遮蔽中のdownを拒否しcapture済みdragは完了する', async ({ page }) => {
  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setOccluded(true);
  });
  await clickSurfaceTarget(page, 'react-action');
  await expect(page.getByTestId('action-count')).toHaveText('0');

  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setOccluded(false);
  });
  await clickSurfaceTarget(page, 'nav-settings');
  const from = await pointFor(page, 'react-range', 0.2, 0.5);
  const to = await pointFor(page, 'react-range', 0.85, 0.5);
  await page.mouse.move(from.x, from.y);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
  await page.mouse.down();
  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setOccluded(true);
  });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByTestId('range-value')).not.toHaveText('42');
  const state = await page.evaluate(
    () => window.__HTML_SURFACE_DEMO__!.getState(),
  );
  expect(state.debug.capturedPointerId).toBeUndefined();
});

test('hoverなしのtouch pointerでbuttonを操作できる', async ({ page }) => {
  const point = await pointFor(page, 'react-action');
  await page.dispatchEvent('#scene', 'pointerdown', {
    pointerId: 17,
    pointerType: 'touch',
    isPrimary: true,
    clientX: point.x,
    clientY: point.y,
    button: 0,
    buttons: 1,
    bubbles: true,
    cancelable: true,
  });
  await page.dispatchEvent('#scene', 'pointerup', {
    pointerId: 17,
    pointerType: 'touch',
    isPrimary: true,
    clientX: point.x,
    clientY: point.y,
    button: 0,
    buttons: 0,
    bubbles: true,
    cancelable: true,
  });

  await expect(page.getByTestId('action-count')).toHaveText('1');
});

test('polyfill hostへ複製されたcanvas click listenerがrouted activationを抑止しない', async ({
  page,
}) => {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
    canvas.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });

  const point = await pointFor(page, 'react-action');
  await page.dispatchEvent('#scene', 'pointerdown', {
    pointerId: 23,
    pointerType: 'touch',
    isPrimary: true,
    clientX: point.x,
    clientY: point.y,
    button: 0,
    buttons: 1,
    bubbles: true,
    cancelable: true,
  });
  await page.dispatchEvent('#scene', 'pointerup', {
    pointerId: 23,
    pointerType: 'touch',
    isPrimary: true,
    clientX: point.x,
    clientY: point.y,
    button: 0,
    buttons: 0,
    bubbles: true,
    cancelable: true,
  });

  await expect(page.getByTestId('action-count')).toHaveText('1');
});
