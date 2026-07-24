# HTML Surface Three RC1 Demo and Browser E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動き続ける3Dモニターへ実用的なReactサイトをTexture表示し、移動・回転・遮蔽中の操作、複数Surface、Tier 1／Tier 2ブラウザ互換性、視覚状態を自動検証する。

**Architecture:** Demoはproduction利用例とE2E fixtureを兼ねる。通常実行では時間駆動アニメーションを行い、`?e2e=1`では公開ライブラリAPIとは別のdemo-only test APIで時刻、遮蔽物、投影座標を固定する。PlaywrightはDOMを直接clickせず、DOM内の対象座標をMesh上へ逆写像してCanvasを操作する。

**Tech Stack:** React 19、Three.js 0.185、Vite 8、Playwright Test、stable Chrome／Edge、Firefox、WebKit

## Global Constraints

- Reactは通常のHTMLElementを生成する利用例であり、ライブラリコアへ依存を追加しない。
- モニターGroup全体が平行移動、上下動、回転する。
- button、input、checkbox、navigation、range drag、scrollを含める。
- 通常Meshによる遮蔽中は新しいdownを拒否し、capture中dragは完了する。
- 2つ目のVanilla Surfaceで複数Surface管理を確認する。
- Tier 1はstable Chrome／Edgeの全シナリオ、Tier 2はFirefox／WebKitのスモークとする。
- Playwright WebKitをSafariそのものとは表現しない。
- Screenshot、video、traceを検証成果物として保存する。
- README、コミット、テスト名は原則日本語にする。
- 新規E2Eは、3D投影とブラウザ入力の統合回帰を検出するために追加する。

---

## File Structure

- Create: `src/demo/MonitorSite.tsx` — navigationとフォームを含むReactサイト
- Create: `src/demo/demo-test-api.ts` — 決定論的時刻、遮蔽、DOM→Canvas投影
- Modify: `src/demo/main.tsx` — moving monitor、diagnostics、test API
- Modify: `src/demo/styles.css` — サイト、モニター、HUD、test controlの表示
- Modify: `index.html` — Capability／focus／captureのHUD
- Delete: `src/demo/ControlPanel.tsx` — 新しいMonitorSiteへ置換
- Create: `playwright.config.ts`
- Create: `tests/e2e/helpers.ts`
- Create: `tests/e2e/tier1.spec.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Create: `tests/e2e/visual.spec.ts`
- Create: `tests/e2e/visual.spec.ts-snapshots/monitor-dashboard-chrome-win32.png`
- Create: `tests/e2e/visual.spec.ts-snapshots/monitor-occluded-chrome-win32.png`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

### Task 1: React Monitor Site

**Files:**
- Create: `src/demo/MonitorSite.tsx`
- Modify: `src/demo/main.tsx`
- Modify: `src/demo/styles.css`
- Delete: `src/demo/ControlPanel.tsx`

**Interfaces:**
- Produces: `MonitorSite({ backend })`
- Consumes: public `BackendKind`
- Required test IDs: `nav-dashboard`, `nav-activity`, `nav-settings`, `react-action`, `action-count`, `react-input`, `react-checkbox`, `react-range`, `range-value`, `react-scroll`

- [ ] **Step 1: 現行demo buildを基準確認する**

Run: `npm run build:demo`

Expected: `dist-demo/index.html`が生成され、exit 0.

- [ ] **Step 2: 3ページのReactサイトを実装する**

`src/demo/MonitorSite.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { BackendKind } from '../index';

type MonitorSiteProps = {
  backend: BackendKind;
};

type Page = 'dashboard' | 'activity' | 'settings';

const EVENTS = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  label: `Surface event ${String(index + 1).padStart(2, '0')}`,
  detail: index % 3 === 0 ? 'pointer routed' : 'texture invalidated',
}));

export function MonitorSite({ backend }: MonitorSiteProps) {
  const [page, setPage] = useState<Page>('dashboard');
  const [actionCount, setActionCount] = useState(0);
  const [signal, setSignal] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [intensity, setIntensity] = useState(42);
  const status = useMemo(
    () => signal.trim() || '入力待ち',
    [signal],
  );

  return (
    <article className="monitor-site" data-page={page}>
      <header className="monitor-site__header">
        <div>
          <b>ORBITAL DESK</b>
          <span>HTML Surface control center</span>
        </div>
        <span className="monitor-site__backend">{backend}</span>
      </header>

      <nav aria-label="サイト内ナビゲーション">
        {(['dashboard', 'activity', 'settings'] as const).map((item) => (
          <button
            aria-current={page === item ? 'page' : undefined}
            data-testid={`nav-${item}`}
            key={item}
            onClick={() => setPage(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </nav>

      <main>
        {page === 'dashboard' && (
          <section className="monitor-site__page" aria-label="Dashboard">
            <div className="metric-grid">
              <div><span>Backend</span><strong>{backend}</strong></div>
              <div><span>Actions</span><strong data-testid="action-count">{actionCount}</strong></div>
              <div><span>Signal</span><strong>{status}</strong></div>
            </div>
            <button
              className="primary-action"
              data-testid="react-action"
              onClick={() => setActionCount((value) => value + 1)}
              type="button"
            >
              Run surface action
            </button>
            <label>
              <span>Signal name</span>
              <input
                data-testid="react-input"
                onChange={(event) => setSignal(event.target.value)}
                value={signal}
              />
            </label>
          </section>
        )}

        {page === 'activity' && (
          <section className="monitor-site__page" aria-label="Activity">
            <div className="monitor-site__scroll" data-testid="react-scroll" tabIndex={0}>
              {EVENTS.map((event) => (
                <p key={event.id}>
                  <b>{event.label}</b>
                  <span>{event.detail}</span>
                </p>
              ))}
            </div>
          </section>
        )}

        {page === 'settings' && (
          <section className="monitor-site__page" aria-label="Settings">
            <label className="toggle-row">
              <input
                checked={notifications}
                data-testid="react-checkbox"
                onChange={(event) => setNotifications(event.target.checked)}
                type="checkbox"
              />
              <span>Surface notifications</span>
            </label>
            <label>
              <span>Display intensity: <b data-testid="range-value">{intensity}</b></span>
              <input
                data-testid="react-range"
                max="100"
                min="0"
                onChange={(event) => setIntensity(Number(event.target.value))}
                type="range"
                value={intensity}
              />
            </label>
          </section>
        )}
      </main>
    </article>
  );
}
```

- [ ] **Step 3: Demo mountをMonitorSiteへ置換する**

```tsx
import { MonitorSite } from './MonitorSite';

reactRoot.render(<MonitorSite backend={manager.backendKind} />);
```

`ControlPanel` importとファイルを削除する。

- [ ] **Step 4: 各ページが720×480のSurface内へ収まるCSSを実装する**

`styles.css`で次を満たす。

- `.react-surface { width: 720px; height: 480px; }`
- `.monitor-site`を720×480、overflow hiddenにする
- header 70px、nav 52px、main残り358px
- button、input、rangeの最小hit sizeを40px以上にする
- `.monitor-site__scroll`を高さ300px、`overflow-y: auto`にする
- active navへ`aria-current="page"`の明示スタイルを付ける
- focus-visible outlineをTexture上でも判別できる色にする

- [ ] **Step 5: buildと型検査を通す**

Run: `npm run typecheck && npm run build:demo`

Expected: exit 0、React componentのunused importなし。

- [ ] **Step 6: コミットする**

```bash
git add src/demo/MonitorSite.tsx src/demo/main.tsx src/demo/styles.css src/demo/ControlPanel.tsx
git commit -m "feat: React製モニターサイトを追加"
```

### Task 2: moving monitorとdeterministic demo test API

**Files:**
- Create: `src/demo/demo-test-api.ts`
- Modify: `src/demo/main.tsx`
- Modify: `src/demo/styles.css`
- Modify: `index.html`

**Interfaces:**
- Produces: `window.__HTML_SURFACE_DEMO__`
- Test API:
  - `ready: Promise<void>`
  - `setAnimationTime(seconds: number): void`
  - `setAnimationPaused(paused: boolean): void`
  - `setOccluded(occluded: boolean): void`
  - `pointFor(testId: string, xRatio?: number, yRatio?: number): { x: number; y: number }`
  - `getState(): { animationTime; paused; occluded; capabilities; debug }`

- [ ] **Step 1: test APIの型と投影関数を実装する**

`src/demo/demo-test-api.ts`:

```ts
import {
  Mesh,
  Vector3,
  type Camera,
  type WebGLRenderer,
} from 'three';
import type {
  CapabilityReport,
  HtmlSurfaceDebugState,
} from '../index';

export type DemoTestState = {
  animationTime: number;
  paused: boolean;
  occluded: boolean;
  capabilities: CapabilityReport;
  debug: HtmlSurfaceDebugState;
};

export type DemoTestApi = {
  ready: Promise<void>;
  setAnimationTime(seconds: number): void;
  setAnimationPaused(paused: boolean): void;
  setOccluded(occluded: boolean): void;
  pointFor(testId: string, xRatio?: number, yRatio?: number): {
    x: number;
    y: number;
  };
  getState(): DemoTestState;
};

declare global {
  interface Window {
    __HTML_SURFACE_DEMO__?: DemoTestApi;
  }
}

export function projectDomTarget(options: {
  root: HTMLElement;
  testId: string;
  screen: Mesh;
  camera: Camera;
  renderer: WebGLRenderer;
  xRatio?: number;
  yRatio?: number;
}): { x: number; y: number } {
  const target = options.root.querySelector<HTMLElement>(
    `[data-testid="${options.testId}"]`,
  );
  if (!target) throw new Error(`Unknown demo test target: ${options.testId}`);
  const rootRect = options.root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const x = targetRect.left - rootRect.left
    + targetRect.width * (options.xRatio ?? 0.5);
  const y = targetRect.top - rootRect.top
    + targetRect.height * (options.yRatio ?? 0.5);
  const u = x / rootRect.width;
  const v = 1 - y / rootRect.height;
  const geometry = options.screen.geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) throw new Error('Monitor screen has no bounding box.');
  const point = new Vector3(
    box.min.x + (box.max.x - box.min.x) * u,
    box.min.y + (box.max.y - box.min.y) * v,
    0,
  );
  options.screen.localToWorld(point);
  point.project(options.camera);
  const canvas = options.renderer.domElement.getBoundingClientRect();
  return {
    x: canvas.left + (point.x + 1) * canvas.width / 2,
    y: canvas.top + (1 - point.y) * canvas.height / 2,
  };
}
```

- [ ] **Step 2: モニターGroupの時間関数を実装する**

`main.tsx`に次を追加し、毎フレーム呼ぶ。

```ts
const monitorOrigin = monitor.group.position.clone();

function applyMonitorMotion(seconds: number) {
  monitor.group.position.set(
    monitorOrigin.x + Math.sin(seconds * 0.43) * 0.42,
    monitorOrigin.y + Math.sin(seconds * 0.67) * 0.18,
    monitorOrigin.z + Math.cos(seconds * 0.31) * 0.12,
  );
  monitor.group.rotation.set(
    Math.sin(seconds * 0.37) * 0.035,
    -0.08 + Math.sin(seconds * 0.29) * 0.12,
    Math.sin(seconds * 0.23) * 0.025,
  );
  monitor.group.updateMatrixWorld(true);
}
```

通常時はelapsed、pause時は保持時刻、E2E modeではtest APIの時刻を使う。

- [ ] **Step 3: 遮蔽物の決定論的配置を実装する**

`setOccluded(true)`ではscreen中央のworld座標とcamera位置を`lerp`し、blockerをscreenよりcamera側へ配置する。`false`では画面右外へ配置する。移動後に`updateMatrixWorld(true)`を呼ぶ。

```ts
function placeOccluder(occluded: boolean) {
  if (!occluded) {
    blocker.position.set(4.6, 2.4, 1.4);
    blocker.scale.setScalar(1);
    blocker.updateMatrixWorld(true);
    return;
  }
  const center = monitor.screen.getWorldPosition(new Vector3());
  blocker.position.copy(center).lerp(camera.position, 0.18);
  blocker.scale.set(5.8, 4.2, 0.35);
  blocker.updateMatrixWorld(true);
}
```

- [ ] **Step 4: window test APIをE2E modeだけ公開する**

```ts
const e2eMode = new URLSearchParams(location.search).has('e2e');
let animationPaused = e2eMode || reducedMotion;
let fixedAnimationTime = 0;
let occluded = false;
let resolveReady!: () => void;
const ready = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

if (e2eMode) {
  window.__HTML_SURFACE_DEMO__ = {
    ready,
    setAnimationTime(seconds) {
      fixedAnimationTime = seconds;
      applyMonitorMotion(seconds);
    },
    setAnimationPaused(paused) {
      animationPaused = paused;
    },
    setOccluded(value) {
      occluded = value;
      placeOccluder(value);
    },
    pointFor(testId, xRatio, yRatio) {
      const reactTarget = reactElement.querySelector(
        `[data-testid="${testId}"]`,
      );
      const descriptor = reactTarget
        ? { root: reactElement, screen: monitor.screen }
        : { root: vanillaElement, screen: secondary.screen };
      return projectDomTarget({
        root: descriptor.root,
        testId,
        screen: descriptor.screen,
        camera,
        renderer,
        xRatio,
        yRatio,
      });
    },
    getState() {
      return {
        animationTime: fixedAnimationTime,
        paused: animationPaused,
        occluded,
        capabilities: manager.getCapabilityReport(),
        debug: manager.getDebugState(),
      };
    },
  };
}
```

最初のrender完了後に`resolveReady()`する。通常modeではtest APIを公開しない。

- [ ] **Step 5: HUDへCapability、focus、captureを追加する**

`index.html`に`#hud-capability`、`#hud-focus`、`#hud-capture`を追加し、`updateHud()`でManagerのreportとdebug stateから更新する。

- [ ] **Step 6: buildと手動smokeを行う**

Run: `npm run typecheck && npm run build:demo`

Expected: exit 0.

Run: `npm run dev -- --host 127.0.0.1`

Expected manual check: モニターが動き、`?e2e=1`では初期時刻で停止し、Consoleからtest APIを呼べる。

- [ ] **Step 7: コミットする**

```bash
git add src/demo/demo-test-api.ts src/demo/main.tsx src/demo/styles.css index.html
git commit -m "feat: 動く3Dモニターと検証APIを追加"
```

### Task 3: Playwright基盤とCanvas操作helper

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/helpers.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `openDemo()`, `pointFor()`, `clickSurfaceTarget()`, `dragSurfaceTarget()`
- Consumes: `window.__HTML_SURFACE_DEMO__`

- [ ] **Step 1: Playwrightを追加する**

Run: `npm install --save-dev @playwright/test`

Run: `npx playwright install chromium firefox webkit`

Expected: browsers installed without error.

- [ ] **Step 2: 段階保証のPlaywright configを実装する**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'artifacts/playwright',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chrome',
      testMatch: /tier1|visual/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'msedge',
      testMatch: /tier1/,
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
    },
    {
      name: 'firefox',
      testMatch: /smoke/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /smoke/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

- [ ] **Step 3: package scriptsとartifact ignoreを追加する**

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:tier1": "playwright test tests/e2e/tier1.spec.ts",
    "test:e2e:smoke": "playwright test tests/e2e/smoke.spec.ts",
    "test:visual": "playwright test tests/e2e/visual.spec.ts --project=chrome"
  }
}
```

`.gitignore`:

```gitignore
artifacts/
playwright-report/
test-results/
```

- [ ] **Step 4: Canvas座標helperを実装する**

```ts
import { expect, type Page } from '@playwright/test';

export async function openDemo(page: Page): Promise<void> {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__HTML_SURFACE_DEMO__ !== undefined);
  await page.evaluate(() => window.__HTML_SURFACE_DEMO__!.ready);
  await expect(page.locator('#loading')).toHaveCount(0);
}

export async function pointFor(
  page: Page,
  testId: string,
  xRatio?: number,
  yRatio?: number,
) {
  return page.evaluate(
    ({ testId, xRatio, yRatio }) => (
      window.__HTML_SURFACE_DEMO__!.pointFor(testId, xRatio, yRatio)
    ),
    { testId, xRatio, yRatio },
  );
}

export async function clickSurfaceTarget(
  page: Page,
  testId: string,
): Promise<void> {
  const point = await pointFor(page, testId);
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
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}
```

- [ ] **Step 5: Playwright configを列挙確認する**

Run: `npx playwright test --list`

Expected: config load成功。テストファイル未作成のため0 testsでもexit 0.

- [ ] **Step 6: コミットする**

```bash
git add package.json package-lock.json playwright.config.ts tests/e2e/helpers.ts .gitignore
git commit -m "test: 段階保証のPlaywright基盤を追加"
```

### Task 4: Tier 1 Chrome／Edge E2E

**Files:**
- Create: `tests/e2e/tier1.spec.ts`

**Interfaces:**
- Consumes: E2E helpers、demo test API
- Produces: navigation、button、input、checkbox、drag、scroll、moving、occlusion、touchのTier 1証拠

- [ ] **Step 1: button、navigation、moving monitorのE2Eを書く**

```ts
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

test('移動・回転後のReactサイトでbuttonとnavigationを操作できる', async ({ page }) => {
  await clickSurfaceTarget(page, 'react-action');
  await expect(page.getByTestId('action-count')).toHaveText('1');

  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setAnimationTime(3.25);
  });
  await clickSurfaceTarget(page, 'react-action');
  await expect(page.getByTestId('action-count')).toHaveText('2');

  await clickSurfaceTarget(page, 'nav-settings');
  await expect(page.locator('.monitor-site')).toHaveAttribute('data-page', 'settings');
});
```

- [ ] **Step 2: input、checkbox、drag、scrollのE2Eを書く**

```ts
test('form control、keyboard、drag、scrollを操作できる', async ({ page }) => {
  await clickSurfaceTarget(page, 'react-input');
  await page.keyboard.type('alpha-7');
  await expect(page.getByTestId('react-input')).toHaveValue('alpha-7');

  await clickSurfaceTarget(page, 'nav-settings');
  await clickSurfaceTarget(page, 'react-checkbox');
  await expect(page.getByTestId('react-checkbox')).not.toBeChecked();

  await dragSurfaceTarget(page, 'react-range', 0.2, 0.82);
  await expect(page.getByTestId('range-value')).not.toHaveText('42');

  await clickSurfaceTarget(page, 'nav-activity');
  const point = await pointFor(page, 'react-scroll');
  const before = await page.getByTestId('react-scroll').evaluate(
    (element) => element.scrollTop,
  );
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 260);
  await expect.poll(() => page.getByTestId('react-scroll').evaluate(
    (element) => element.scrollTop,
  )).toBeGreaterThan(before);
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
```

- [ ] **Step 3: 遮蔽とcaptureのE2Eを書く**

```ts
test('遮蔽中のdownを拒否し、開始済みdragはcaptureで完了する', async ({ page }) => {
  await page.evaluate(() => window.__HTML_SURFACE_DEMO__!.setOccluded(true));
  await clickSurfaceTarget(page, 'react-action');
  await expect(page.getByTestId('action-count')).toHaveText('0');

  await page.evaluate(() => window.__HTML_SURFACE_DEMO__!.setOccluded(false));
  await clickSurfaceTarget(page, 'nav-settings');
  const from = await pointFor(page, 'react-range', 0.2, 0.5);
  const to = await pointFor(page, 'react-range', 0.85, 0.5);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.evaluate(() => window.__HTML_SURFACE_DEMO__!.setOccluded(true));
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('range-value')).not.toHaveText('42');
});
```

- [ ] **Step 4: touch PointerEventのE2Eを書く**

```ts
test('事前hoverなしのtouch pointerでbuttonをactivationできる', async ({ page }) => {
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
```

- [ ] **Step 5: Chromeで失敗を確認して入力／投影bugだけを修正する**

Run: `npx playwright test tests/e2e/tier1.spec.ts --project=chrome`

Expected before fixes: 少なくとも新規シナリオがFAILし、traceにCanvas座標またはevent routingが記録される。

修正範囲は`src/demo/demo-test-api.ts`、`src/demo/main.tsx`、`src/input/**`、`src/HtmlSurfaceManager.ts`に限定し、テスト期待値は要件を弱めるために変更しない。

- [ ] **Step 6: Chrome／Edgeで全Tier 1を通す**

Run: `npm run test:e2e:tier1`

Expected: chromeとmsedgeの全テストPASS。

- [ ] **Step 7: コミットする**

```bash
git add tests/e2e/tier1.spec.ts src/demo src/input src/HtmlSurfaceManager.ts
git commit -m "test: moving monitorのTier 1 E2Eを追加"
```

### Task 5: Firefox／WebKit smokeと視覚比較

**Files:**
- Create: `tests/e2e/smoke.spec.ts`
- Create: `tests/e2e/visual.spec.ts`
- Create: `tests/e2e/visual.spec.ts-snapshots/monitor-dashboard-chrome-win32.png`
- Create: `tests/e2e/visual.spec.ts-snapshots/monitor-occluded-chrome-win32.png`

**Interfaces:**
- Consumes: E2E helpers、demo test API
- Produces: Tier 2 smokeと決定論的画像baseline

- [ ] **Step 1: Tier 2 smokeを書く**

```ts
import { expect, test } from '@playwright/test';
import { clickSurfaceTarget, openDemo, pointFor } from './helpers';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('polyfill経路で表示、button、input、scrollが動作する', async ({ page }) => {
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
  const point = await pointFor(page, 'react-scroll');
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 180);
  await expect.poll(() => page.getByTestId('react-scroll').evaluate(
    (element) => element.scrollTop,
  )).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Chrome視覚比較を書く**

```ts
import { expect, test } from '@playwright/test';
import { clickSurfaceTarget, openDemo } from './helpers';

test('Dashboardと遮蔽状態の見た目がbaselineと一致する', async ({ page }) => {
  await openDemo(page);
  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setAnimationTime(1.75);
    window.__HTML_SURFACE_DEMO__!.setOccluded(false);
  });
  await expect(page).toHaveScreenshot('monitor-dashboard.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.04,
  });

  await page.evaluate(() => {
    window.__HTML_SURFACE_DEMO__!.setOccluded(true);
  });
  await expect(page).toHaveScreenshot('monitor-occluded.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.04,
  });
});

test('別ページへ遷移してもTexture表示が更新される', async ({ page }) => {
  await openDemo(page);
  await clickSurfaceTarget(page, 'nav-settings');
  await expect(page.locator('.monitor-site')).toHaveAttribute(
    'data-page',
    'settings',
  );
  await expect(page).toHaveScreenshot('monitor-settings.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.04,
  });
});
```

- [ ] **Step 3: Tier 2 smokeを通す**

Run: `npm run test:e2e:smoke`

Expected: firefox、webkitの両projectがPASS。

- [ ] **Step 4: Windows Chrome baselineを生成して目視確認する**

Run: `npm run test:visual -- --update-snapshots`

Expected: 3 PNG baseline生成、visual tests PASS。

3画像を開き、次を目視する。

- モニター筐体内へReactサイトが収まっている
- Perspective、回転、Textureの上下が正しい
- 遮蔽物が画面より前に描画される
- Settings遷移がTextureへ反映される
- HUDがモニターを覆わない

- [ ] **Step 5: E2E動画、trace、スクリーンショットを保存する**

`playwright-e2e-recorder:record-playwright-e2e`スキルを使い、ChromeのTier 1主要シナリオを1本の注釈付き動画として`artifacts/e2e-recording/`へ保存する。記録にはbutton、input、scroll、movement、occlusion、dragを含める。

- [ ] **Step 6: コミットする**

```bash
git add tests/e2e/smoke.spec.ts tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots
git commit -m "test: Tier 2 smokeと視覚比較を追加"
```

## Plan 3 Completion Gate

- [ ] moving monitorを通常modeで目視操作できる
- [ ] React navigation、button、input、checkbox、range、scrollをCanvas座標から操作できる
- [ ] Vanilla Surfaceも独立して操作できる
- [ ] `npm run test:e2e:tier1`
- [ ] `npm run test:e2e:smoke`
- [ ] `npm run test:visual`
- [ ] screenshot baselineを目視レビュー済み
- [ ] E2E動画とtraceがartifactへ保存されている
- [ ] `npm run typecheck`
- [ ] `npm run build:demo`
- [ ] `git status --short`がclean
