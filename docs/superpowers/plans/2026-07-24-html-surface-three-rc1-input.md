# HTML Surface Three RC1 Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 遮蔽を含むhit結果を実DOMへ安全に結び付け、pointer、focus、keyboard、IME、wheel、scroll、drag、touch、Pointer Captureを動くSurface上で扱う。

**Architecture:** RaycastとUV変換はManager側のSurface解決として維持し、DOMイベントの状態機械を`DomInputRouter`へ分離する。pointer session、DOM activation、scroll判定を個別の純粋ロジックにしてからRouterへ統合し、Managerは`routePoint()`とSurface登録だけを提供する。

**Tech Stack:** TypeScript 7、DOM Pointer Events、Three.js Raycaster、Vitest 4、happy-dom、Playwrightで後続検証

## Global Constraints

- Capture開始前は通常Meshによる遮蔽を厳守する。
- Capture後はMesh外または一時的な遮蔽中でも同じtargetへmove／up／cancelを配送する。
- keyboardとcomposition eventは合成せず、実DOMのfocusへブラウザから配送させる。
- 事前hoverのないtouch／penの最初のpointerdownをCanvasから補助する。
- 同一イベントをnative経路とsynthetic経路で二重配送しない。
- Surface外のpointer／wheelはOrbitControlsなど既存Canvas利用者へ残す。
- Surface無効化・破棄・Manager破棄でsessionとcaptureを必ず解放する。
- コミットメッセージは日本語で記述する。
- 新規テストは、pointer状態機械と入力配送の回帰を防ぐために追加する。

---

## File Structure

- Create: `src/input/pointer-session.ts` — `pointerId`ごとのdown／capture／cleanup状態
- Create: `src/input/dom-target.ts` — target解決、focus、PointerEvent複製、activation
- Create: `src/input/scroll-routing.ts` — scroll可能祖先とdelta消費判定
- Create: `src/input/dom-input-router.ts` — CanvasとSurface DOMのイベント統合
- Modify: `src/HtmlSurfaceManager.ts` — RouterへSurface hitとDOM配置を提供
- Modify: `src/index.ts` — debug state拡張だけを公開
- Test: `tests/pointer-session.test.ts`
- Test: `tests/dom-target.test.ts`
- Test: `tests/scroll-routing.test.ts`
- Test: `tests/dom-input-router.test.ts`
- Test: `tests/manager-input-integration.test.ts`

### Task 1: pointer session状態機械

**Files:**
- Create: `src/input/pointer-session.ts`
- Create: `tests/pointer-session.test.ts`

**Interfaces:**
- Produces: `PointerSession<TSurface>`, `PointerSessionStore<TSurface>`
- Consumes: Surface ID、DOM target、`pointerId`

- [ ] **Step 1: down、capture、finish、Surface cleanupの失敗テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { PointerSessionStore } from '../src/input/pointer-session';

type Surface = { id: string };

describe('PointerSessionStore', () => {
  it('pointerIdごとにtargetとcapture状態を保持する', () => {
    const store = new PointerSessionStore<Surface>();
    const surface = { id: 'panel' };
    const target = {} as Element;

    store.start({
      pointerId: 7,
      pointerType: 'touch',
      surface,
      target,
      source: 'canvas',
    });
    store.setCaptured(7, true);

    expect(store.get(7)).toMatchObject({
      pointerId: 7,
      pointerType: 'touch',
      surface,
      target,
      source: 'canvas',
      captured: true,
    });
  });

  it('up／cancelとSurface破棄で該当sessionを返して削除する', () => {
    const store = new PointerSessionStore<Surface>();
    const first = { id: 'first' };
    const second = { id: 'second' };
    store.start({
      pointerId: 1, pointerType: 'mouse', surface: first,
      target: {} as Element, source: 'dom',
    });
    store.start({
      pointerId: 2, pointerType: 'touch', surface: first,
      target: {} as Element, source: 'canvas',
    });
    store.start({
      pointerId: 3, pointerType: 'pen', surface: second,
      target: {} as Element, source: 'canvas',
    });

    expect(store.finish(1)?.pointerId).toBe(1);
    expect(store.cancelSurface(first).map((item) => item.pointerId)).toEqual([2]);
    expect(store.values().map((item) => item.pointerId)).toEqual([3]);
  });

  it('同じpointerIdの再開始は古いsessionを置き換える', () => {
    const store = new PointerSessionStore<Surface>();
    const first = { id: 'first' };
    const second = { id: 'second' };
    store.start({
      pointerId: 1, pointerType: 'mouse', surface: first,
      target: {} as Element, source: 'dom',
    });
    store.start({
      pointerId: 1, pointerType: 'mouse', surface: second,
      target: {} as Element, source: 'canvas',
    });
    expect(store.get(1)?.surface).toBe(second);
  });
});
```

- [ ] **Step 2: テストがmodule未実装で失敗することを確認する**

Run: `npx vitest run tests/pointer-session.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: 状態機械を実装する**

```ts
export type PointerSession<Surface> = {
  pointerId: number;
  pointerType: string;
  surface: Surface;
  target: Element;
  source: 'canvas' | 'dom';
  captured: boolean;
};

export class PointerSessionStore<Surface> {
  private readonly sessions = new Map<number, PointerSession<Surface>>();

  start(
    input: Omit<PointerSession<Surface>, 'captured'>,
  ): PointerSession<Surface> {
    const session = { ...input, captured: false };
    this.sessions.set(input.pointerId, session);
    return session;
  }

  get(pointerId: number): PointerSession<Surface> | undefined {
    return this.sessions.get(pointerId);
  }

  setCaptured(pointerId: number, captured: boolean): void {
    const session = this.sessions.get(pointerId);
    if (session) session.captured = captured;
  }

  finish(pointerId: number): PointerSession<Surface> | undefined {
    const session = this.sessions.get(pointerId);
    this.sessions.delete(pointerId);
    return session;
  }

  cancelSurface(surface: Surface): PointerSession<Surface>[] {
    const removed = this.values().filter((item) => item.surface === surface);
    for (const item of removed) this.sessions.delete(item.pointerId);
    return removed;
  }

  clear(): PointerSession<Surface>[] {
    const removed = this.values();
    this.sessions.clear();
    return removed;
  }

  values(): PointerSession<Surface>[] {
    return [...this.sessions.values()];
  }
}
```

- [ ] **Step 4: テストと型検査を通す**

Run: `npx vitest run tests/pointer-session.test.ts && npm run typecheck`

Expected: PASS、typecheck exit 0.

- [ ] **Step 5: コミットする**

```bash
git add src/input/pointer-session.ts tests/pointer-session.test.ts
git commit -m "feat: pointer session状態機械を追加"
```

### Task 2: DOM target、focus、synthetic event、activation

**Files:**
- Create: `src/input/dom-target.ts`
- Create: `tests/dom-target.test.ts`

**Interfaces:**
- Produces: `resolveDomTarget()`, `focusDomTarget()`, `dispatchPointerClone()`, `activateDomTarget()`
- Consumes: Surface root、client座標、元PointerEvent

- [ ] **Step 1: DOM target helperの失敗テストを書く**

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import {
  activateDomTarget,
  dispatchPointerClone,
  focusDomTarget,
  resolveDomTarget,
} from '../src/input/dom-target';

describe('DOM input target helpers', () => {
  it('elementFromPointがSurface内の要素だけを返す', () => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    root.append(button);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(button);
    expect(resolveDomTarget(root, 10, 20)).toBe(button);
    vi.mocked(document.elementFromPoint).mockReturnValue(document.body);
    expect(resolveDomTarget(root, 10, 20)).toBeUndefined();
  });

  it('focus可能なtargetへpreventScroll付きでfocusする', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const focus = vi.spyOn(input, 'focus');
    focusDomTarget(input);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('PointerEventの主要プロパティを複製して配送する', () => {
    const target = document.createElement('div');
    const listener = vi.fn();
    target.addEventListener('pointerdown', listener);
    const source = new PointerEvent('pointerdown', {
      pointerId: 4,
      pointerType: 'touch',
      clientX: 30,
      clientY: 40,
      bubbles: true,
    });
    expect(dispatchPointerClone(target, 'pointerdown', source)).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    const cloned = listener.mock.calls[0]?.[0] as PointerEvent;
    expect(cloned.pointerId).toBe(4);
    expect(cloned.pointerType).toBe('touch');
    expect(cloned.clientX).toBe(30);
  });

  it('disabledでないHTMLElementだけをclick activationする', () => {
    const button = document.createElement('button');
    const click = vi.spyOn(button, 'click');
    expect(activateDomTarget(button)).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    button.disabled = true;
    expect(activateDomTarget(button)).toBe(false);
  });
});
```

- [ ] **Step 2: helperテストが失敗することを確認する**

Run: `npx vitest run tests/dom-target.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: target解決とfocusを実装する**

```ts
export function resolveDomTarget(
  root: HTMLElement,
  clientX: number,
  clientY: number,
): Element | undefined {
  const target = document.elementFromPoint(clientX, clientY);
  return target && root.contains(target) ? target : undefined;
}

export function focusDomTarget(target: Element): void {
  if (target instanceof HTMLElement) {
    target.focus({ preventScroll: true });
  }
}
```

- [ ] **Step 4: PointerEvent複製とactivationを実装する**

```ts
export function dispatchPointerClone(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  source: PointerEvent,
): boolean {
  return target.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: source.pointerId,
    pointerType: source.pointerType,
    isPrimary: source.isPrimary,
    clientX: source.clientX,
    clientY: source.clientY,
    screenX: source.screenX,
    screenY: source.screenY,
    button: source.button,
    buttons: source.buttons,
    pressure: source.pressure,
    tangentialPressure: source.tangentialPressure,
    tiltX: source.tiltX,
    tiltY: source.tiltY,
    twist: source.twist,
    width: source.width,
    height: source.height,
    ctrlKey: source.ctrlKey,
    shiftKey: source.shiftKey,
    altKey: source.altKey,
    metaKey: source.metaKey,
  }));
}

export function activateDomTarget(target: Element): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLButtonElement
    || target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
  ) {
    if (target.disabled) return false;
  }
  target.click();
  return true;
}
```

- [ ] **Step 5: helperテストと型検査を通す**

Run: `npx vitest run tests/dom-target.test.ts && npm run typecheck`

Expected: PASS、typecheck exit 0.

- [ ] **Step 6: コミットする**

```bash
git add src/input/dom-target.ts tests/dom-target.test.ts
git commit -m "feat: DOM入力targetの補助処理を追加"
```

### Task 3: nested scroll routing

**Files:**
- Create: `src/input/scroll-routing.ts`
- Create: `tests/scroll-routing.test.ts`

**Interfaces:**
- Produces: `findScrollableTarget()`, `applyWheelDelta()`
- Consumes: Surface root、DOM target、WheelEventのdelta

- [ ] **Step 1: 方向を考慮したscroll対象の失敗テストを書く**

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import {
  applyWheelDelta,
  findScrollableTarget,
} from '../src/input/scroll-routing';

function setMetrics(
  element: HTMLElement,
  values: Partial<Pick<
    HTMLElement,
    'clientHeight' | 'scrollHeight' | 'scrollTop'
  >>,
) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(element, key, {
      configurable: true,
      value,
      writable: true,
    });
  }
}

describe('scroll routing', () => {
  it('delta方向へ動ける最も内側のscroll要素を選ぶ', () => {
    const root = document.createElement('div');
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    root.append(outer);
    outer.append(inner);
    setMetrics(inner, { clientHeight: 100, scrollHeight: 300, scrollTop: 200 });
    setMetrics(outer, { clientHeight: 100, scrollHeight: 400, scrollTop: 20 });
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => ({
      overflowY: element === root ? 'visible' : 'auto',
      overflowX: 'visible',
    } as CSSStyleDeclaration));

    expect(findScrollableTarget(root, inner, 30)).toBe(outer);
    expect(findScrollableTarget(root, inner, -30)).toBe(inner);
  });

  it('deltaを適用し、実際にscrollできた時だけtrueを返す', () => {
    const element = document.createElement('div');
    setMetrics(element, { clientHeight: 100, scrollHeight: 300, scrollTop: 20 });
    expect(applyWheelDelta(element, 40)).toBe(true);
    expect(element.scrollTop).toBe(60);
  });
});
```

- [ ] **Step 2: scrollテストが失敗することを確認する**

Run: `npx vitest run tests/scroll-routing.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: scroll候補探索を実装する**

```ts
function canScroll(element: HTMLElement, deltaY: number): boolean {
  const style = getComputedStyle(element);
  if (!['auto', 'scroll'].includes(style.overflowY)) return false;
  const maximum = element.scrollHeight - element.clientHeight;
  if (maximum <= 0) return false;
  return deltaY < 0 ? element.scrollTop > 0 : element.scrollTop < maximum;
}

export function findScrollableTarget(
  root: HTMLElement,
  start: Element,
  deltaY: number,
): HTMLElement | undefined {
  let current: Element | null = start;
  while (current && root.contains(current)) {
    if (current instanceof HTMLElement && canScroll(current, deltaY)) {
      return current;
    }
    if (current === root) break;
    current = current.parentElement;
  }
  return undefined;
}
```

- [ ] **Step 4: delta適用を実装する**

```ts
export function applyWheelDelta(
  element: HTMLElement,
  deltaY: number,
): boolean {
  const before = element.scrollTop;
  const maximum = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = Math.min(maximum, Math.max(0, before + deltaY));
  return element.scrollTop !== before;
}
```

- [ ] **Step 5: scrollテストと型検査を通す**

Run: `npx vitest run tests/scroll-routing.test.ts && npm run typecheck`

Expected: PASS、typecheck exit 0.

- [ ] **Step 6: コミットする**

```bash
git add src/input/scroll-routing.ts tests/scroll-routing.test.ts
git commit -m "feat: nested scrollの入力配送を追加"
```

### Task 4: DomInputRouter

**Files:**
- Create: `src/input/dom-input-router.ts`
- Create: `tests/dom-input-router.test.ts`

**Interfaces:**
- Consumes: `PointerSessionStore`, DOM target helpers、scroll helpers、`routePoint(clientX, clientY)`
- Produces: `InputSurface`, `RoutedSurfaceHit`, `DomInputRouter`, `InputDebugState`

- [ ] **Step 1: Router harnessと失敗テストを書く**

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import {
  DomInputRouter,
  type InputSurface,
  type RoutedSurfaceHit,
} from '../src/input/dom-input-router';

function createHarness() {
  const canvas = document.createElement('canvas');
  const root = document.createElement('div');
  const button = document.createElement('button');
  root.append(button);
  document.body.append(canvas, root);
  const surface: InputSurface = {
    id: 'panel',
    element: root,
    enabled: true,
    invalidate: vi.fn(),
  };
  const routePoint = vi.fn<
    (clientX: number, clientY: number) => RoutedSurfaceHit | undefined
  >(() => ({
    surface,
    domPoint: { x: 10, y: 10 },
  }));
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(button);
  const router = new DomInputRouter({ canvas, routePoint });
  router.registerSurface(surface);
  return { button, canvas, root, routePoint, router, surface };
}

describe('DomInputRouter', () => {
  it('Canvasから始まるtouch downをDOM targetへ配送しclickまで完了する', () => {
    const { button, canvas, router } = createHarness();
    const down = vi.fn();
    const click = vi.fn();
    button.addEventListener('pointerdown', down);
    button.addEventListener('click', click);

    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 5,
      pointerType: 'touch',
      clientX: 100,
      clientY: 120,
      bubbles: true,
      cancelable: true,
    }));
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 5,
      pointerType: 'touch',
      clientX: 100,
      clientY: 120,
      bubbles: true,
      cancelable: true,
    }));

    expect(down).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(router.getDebugState().capturedPointerId).toBeUndefined();
  });

  it('capture中はroutePointが遮蔽を返しても同じtargetへmove/upを配送する', () => {
    const { button, canvas, routePoint } = createHarness();
    const move = vi.fn();
    const up = vi.fn();
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', up);
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 2, pointerType: 'mouse', clientX: 10, clientY: 10,
      bubbles: true, cancelable: true,
    }));
    routePoint.mockReturnValue(undefined);
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 2, pointerType: 'mouse', clientX: 500, clientY: 500,
      bubbles: true, cancelable: true,
    }));
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 2, pointerType: 'mouse', clientX: 500, clientY: 500,
      bubbles: true, cancelable: true,
    }));
    expect(move).toHaveBeenCalledOnce();
    expect(up).toHaveBeenCalledOnce();
  });

  it('非capture hoverは遮蔽時にSurfaceをactiveにしない', () => {
    const { canvas, routePoint, router } = createHarness();
    routePoint.mockReturnValue(undefined);
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 1, clientX: 20, clientY: 20, bubbles: true,
    }));
    expect(router.getDebugState().surfaceId).toBeUndefined();
  });

  it('unregisterでSurface sessionをpointercancelして解放する', () => {
    const { button, canvas, router, surface } = createHarness();
    const cancel = vi.fn();
    button.addEventListener('pointercancel', cancel);
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 9, clientX: 20, clientY: 20,
      bubbles: true, cancelable: true,
    }));
    router.unregisterSurface(surface);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Routerテストが失敗することを確認する**

Run: `npx vitest run tests/dom-input-router.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Routerの公開型と接続処理を実装する**

```ts
export type InputSurface = {
  readonly id: string;
  readonly element: HTMLElement;
  readonly enabled: boolean;
  invalidate(): void;
};

export type RoutedSurfaceHit = {
  surface: InputSurface;
  domPoint: { x: number; y: number };
};

export type InputDebugState = {
  surfaceId?: string;
  focusTarget?: string;
  capturedPointerId?: number;
};

export type DomInputRouterOptions = {
  canvas: HTMLCanvasElement;
  routePoint(
    clientX: number,
    clientY: number,
  ): RoutedSurfaceHit | undefined;
};
```

`DomInputRouter`はConstructorでCanvasへcapture phaseの`pointermove`、`pointerdown`、`pointerup`、`pointercancel`、`wheel`を登録し、`dispose()`で同じlistenerを解除する。`registerSurface()`はSurface rootへpointer、wheel、focusin／focusout、got／lostpointercaptureを登録し、cleanupをMapへ保存する。

- [ ] **Step 4: Canvas synthetic経路を実装する**

Canvas `pointerdown`では次を順に実行する。

```ts
const hit = this.options.routePoint(event.clientX, event.clientY);
if (!hit?.surface.enabled) return;
const target = resolveDomTarget(
  hit.surface.element,
  event.clientX,
  event.clientY,
);
if (!target) return;
event.preventDefault();
event.stopImmediatePropagation();
focusDomTarget(target);
const session = this.sessions.start({
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  surface: hit.surface,
  target,
  source: 'canvas',
});
dispatchPointerClone(target, 'pointerdown', event);
try {
  this.options.canvas.setPointerCapture(event.pointerId);
  session.captured = true;
} catch {
  session.captured = true;
}
```

Canvas `pointermove`はsessionがあれば同じtargetへcloneし、なければ`routePoint()`だけを呼ぶ。`pointerup`は同じtargetへcloneしてから`activateDomTarget()`し、Canvas captureを解放してsessionをfinishする。`pointercancel`はclone後にactivationせずfinishする。

- [ ] **Step 5: Surface native経路とfocus scopeを実装する**

Surface rootのcapture listenerでは次を行う。

- event targetがSurface内であり、`routePoint()`が同じSurfaceを返す場合だけdown sessionを開始
- native event自体はcloneしない
- down時に`target.setPointerCapture(pointerId)`を試す
- `gotpointercapture`／`lostpointercapture`でsessionのcapturedを更新
- capturedでないmove／upは`routePoint()`が同じSurfaceでなければpreventする
- focusinでSurfaceをfocus保持対象にし、focusoutでroot外へ移った場合に解除
- pointer activeまたはfocus保持中のSurfaceだけ`inert = false`
- それ以外のSurfaceは`inert = true`

- [ ] **Step 6: wheel経路を実装する**

Surface内wheelはnative scrollを妨げず、microtaskで`surface.invalidate()`する。Canvas wheelは次を行う。

```ts
const hit = this.options.routePoint(event.clientX, event.clientY);
if (!hit) return;
const target = resolveDomTarget(
  hit.surface.element,
  event.clientX,
  event.clientY,
);
if (!target) return;
const scrollable = findScrollableTarget(
  hit.surface.element,
  target,
  event.deltaY,
);
if (!scrollable || !applyWheelDelta(scrollable, event.deltaY)) return;
event.preventDefault();
event.stopImmediatePropagation();
hit.surface.invalidate();
```

- [ ] **Step 7: Routerテストを通す**

Run: `npx vitest run tests/dom-input-router.test.ts tests/dom-target.test.ts tests/pointer-session.test.ts tests/scroll-routing.test.ts && npm run typecheck`

Expected: 4 files PASS、typecheck exit 0.

- [ ] **Step 8: コミットする**

```bash
git add src/input/dom-input-router.ts tests/dom-input-router.test.ts
git commit -m "feat: DOM入力Routerを実装"
```

### Task 5: ManagerとInput Routerの統合

**Files:**
- Modify: `src/HtmlSurfaceManager.ts`
- Modify: `src/index.ts`
- Create: `tests/manager-input-integration.test.ts`
- Modify: `tests/manager-lifecycle.test.ts`

**Interfaces:**
- Consumes: `DomInputRouter`, `InputSurface`, `RoutedSurfaceHit`
- Produces: `HtmlSurfaceDebugState.focusTarget`, `.capturedPointerId`、毎フレーム追従する`manager.update()`

- [ ] **Step 1: Manager統合の失敗テストを書く**

```ts
// @vitest-environment happy-dom
import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Texture,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { HtmlSurfaceManager } from '../src/HtmlSurfaceManager';
import type { HtmlTextureBackend } from '../src/backends/html-texture-backend';

describe('HtmlSurfaceManager input integration', () => {
  it('Surface無効化と破棄でactive pointer sessionを解放する', () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    const backend: HtmlTextureBackend = {
      kind: 'polyfill',
      nativeAvailable: false,
      requestPaint: vi.fn(),
      mount: vi.fn(() => ({
        texture: new Texture(),
        ready: Promise.resolve(),
        invalidate: vi.fn(),
        dispose: vi.fn(),
      })),
    };
    const manager = new HtmlSurfaceManager({
      renderer: { domElement: canvas } as never,
      camera: new PerspectiveCamera(),
      scene: new Scene(),
      backend,
    });
    const root = document.createElement('div');
    const button = document.createElement('button');
    root.append(button);
    document.body.append(root);
    const surface = manager.add({
      id: 'panel',
      element: root,
      mesh: new Mesh(new PlaneGeometry(), new MeshBasicMaterial()),
    });

    surface.setEnabled(false);
    expect(root.inert).toBe(true);
    surface.setEnabled(true);
    expect(surface.enabled).toBe(true);
    surface.dispose();
    expect(manager.getDebugState().capturedPointerId).toBeUndefined();
  });
});
```

- [ ] **Step 2: 統合テストが未接続で失敗することを確認する**

Run: `npx vitest run tests/manager-input-integration.test.ts`

Expected: FAIL because the Router does not control `inert` or debug state.

- [ ] **Step 3: Managerから旧イベント処理を取り除く**

次を`HtmlSurfaceManager`から削除する。

- `STOPPED_EVENTS`
- `canvasCleanup`
- `connectCanvasEvents()`
- `connectSurfaceEvents()`
- `scrollSurfaceAtPoint()`
- Manager内のpointer session相当処理

Manager constructorで`DomInputRouter`を生成する。

```ts
this.inputRouter = new DomInputRouter({
  canvas: this.renderer.domElement,
  routePoint: (clientX, clientY) => this.routePointer(clientX, clientY),
});
```

`add()`成功後に`registerSurface(record)`、remove前に`unregisterSurface(record)`、Manager破棄時に`inputRouter.dispose()`を呼ぶ。

- [ ] **Step 4: routePointerをRouter向け結果へ変更する**

Surface hit時はDOMを整列してから次を返す。

```ts
return {
  surface,
  domPoint,
};
```

none／blocked／zero sizeでは全Surfaceをparkして`undefined`を返す。`update()`はRouterが保持する最後のpointer位置を再評価する`inputRouter.update()`を呼ぶ。

- [ ] **Step 5: debug stateを拡張する**

```ts
export type HtmlSurfaceDebugState = {
  kind: 'none' | 'blocked' | 'surface';
  objectName?: string;
  surfaceId?: string;
  uv?: UvPoint;
  domPoint?: DomPoint;
  focusTarget?: string;
  capturedPointerId?: number;
};
```

Routerのstate変更時にManagerのhit stateとmergeし、`onDebugChange`へ防御的コピーを渡す。

- [ ] **Step 6: 入力統合と全テストを通す**

Run: `npm test && npm run typecheck && npm run build:lib`

Expected: all tests PASS、typecheck exit 0、library build成功。

- [ ] **Step 7: コミットする**

```bash
git add src/HtmlSurfaceManager.ts src/index.ts tests/manager-input-integration.test.ts tests/manager-lifecycle.test.ts
git commit -m "feat: 遮蔽対応入力RouterをManagerへ統合"
```

## Plan 2 Completion Gate

- [ ] pointerdown／move／up／cancelがunitとDOM integrationで確認されている
- [ ] Pointer Capture中だけ遮蔽後も配送が継続する
- [ ] Canvas起点touchがbuttonをactivationできる
- [ ] keyboard／IMEは合成していない
- [ ] nested scrollが方向境界で外側へ伝播する
- [ ] Surface無効化／破棄でsessionが残らない
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build:lib`
- [ ] `git status --short`がclean
