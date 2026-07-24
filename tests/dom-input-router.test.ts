// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import {
  DomInputRouter,
  type InputSurface,
  type RoutedSurfaceHit,
} from '../src/input/dom-input-router';

function pointer(
  type: string,
  overrides: PointerEventInit = {},
): PointerEvent {
  return new PointerEvent(type, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: 100,
    clientY: 120,
    bubbles: true,
    cancelable: true,
    ...overrides,
  });
}

function createHarness(options: {
  forwardCanvasEventsThroughHost?: boolean;
  rootUnderCanvas?: boolean;
} = {}) {
  const canvas = document.createElement('canvas');
  const host = document.createElement('div');
  const root = document.createElement('div');
  const button = document.createElement('button');
  root.append(button);
  if (options.rootUnderCanvas) {
    canvas.append(root);
  } else {
    host.append(root);
  }
  document.body.append(canvas, host);
  if (options.forwardCanvasEventsThroughHost) {
    const forwarded = new Map<
      EventListenerOrEventListenerObject,
      Map<string, EventListener>
    >();
    const nativeAdd = canvas.addEventListener.bind(canvas);
    const nativeRemove = canvas.removeEventListener.bind(canvas);
    Object.defineProperties(canvas, {
      addEventListener: {
        configurable: true,
        value(
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          eventOptions?: AddEventListenerOptions | boolean,
        ) {
          if (!listener) return;
          nativeAdd(type, listener, eventOptions);
          if (!type.startsWith('pointer')) return;
          const forwardedListener: EventListener = (event) => {
            if (typeof listener === 'function') {
              listener.call(canvas, event);
            } else {
              listener.handleEvent(event);
            }
          };
          const byType = forwarded.get(listener) ?? new Map();
          byType.set(type, forwardedListener);
          forwarded.set(listener, byType);
          host.addEventListener(type, forwardedListener, eventOptions);
        },
      },
      removeEventListener: {
        configurable: true,
        value(
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          eventOptions?: EventListenerOptions | boolean,
        ) {
          if (!listener) return;
          nativeRemove(type, listener, eventOptions);
          const forwardedListener = forwarded.get(listener)?.get(type);
          if (forwardedListener) {
            host.removeEventListener(
              type,
              forwardedListener,
              eventOptions,
            );
          }
        },
      },
    });
  }
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
  const router = new DomInputRouter({
    canvas,
    routePoint,
  });
  router.registerSurface(surface);

  return {
    button,
    canvas,
    root,
    routePoint,
    router,
    surface,
  };
}

describe('DomInputRouter', () => {
  it('polyfill hostへ転送された複製PointerEventで再入しない', () => {
    const { button, canvas } = createHarness({
      forwardCanvasEventsThroughHost: true,
    });
    const click = vi.fn();
    button.addEventListener('click', click);

    canvas.dispatchEvent(pointer('pointerdown', {
      pointerId: 4,
      buttons: 1,
    }));
    canvas.dispatchEvent(pointer('pointerup', {
      pointerId: 4,
      buttons: 0,
    }));

    expect(click).toHaveBeenCalledOnce();
  });

  it('Canvas配下へ配送した複製PointerEventで再入しない', () => {
    const { button, canvas } = createHarness({
      rootUnderCanvas: true,
    });
    const click = vi.fn();
    button.addEventListener('click', click);

    canvas.dispatchEvent(pointer('pointerdown', {
      pointerId: 6,
      buttons: 1,
    }));
    canvas.dispatchEvent(pointer('pointerup', {
      pointerId: 6,
      buttons: 0,
    }));

    expect(click).toHaveBeenCalledOnce();
  });

  it('Surface内部のnative pointerをhost上のCanvas listenerへ漏らさない', () => {
    const { button, canvas } = createHarness({
      forwardCanvasEventsThroughHost: true,
    });
    const controlsPointerDown = vi.fn();
    canvas.addEventListener('pointerdown', controlsPointerDown);

    button.dispatchEvent(pointer('pointerdown', {
      pointerId: 8,
      buttons: 1,
    }));

    expect(controlsPointerDown).not.toHaveBeenCalled();
  });

  it('Canvasから始まるtouch downをDOM targetへ配送しclickまで完了する', () => {
    const { button, canvas, router } = createHarness();
    const down = vi.fn();
    const click = vi.fn();
    button.addEventListener('pointerdown', down);
    button.addEventListener('click', click);

    canvas.dispatchEvent(pointer('pointerdown', {
      pointerId: 5,
      pointerType: 'touch',
      buttons: 1,
    }));
    canvas.dispatchEvent(pointer('pointerup', {
      pointerId: 5,
      pointerType: 'touch',
      buttons: 0,
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
    canvas.dispatchEvent(pointer('pointerdown', {
      pointerId: 2,
      buttons: 1,
    }));
    routePoint.mockReturnValue(undefined);

    canvas.dispatchEvent(pointer('pointermove', {
      pointerId: 2,
      clientX: 500,
      clientY: 500,
      buttons: 1,
    }));
    canvas.dispatchEvent(pointer('pointerup', {
      pointerId: 2,
      clientX: 500,
      clientY: 500,
      buttons: 0,
    }));

    expect(move).toHaveBeenCalledOnce();
    expect(up).toHaveBeenCalledOnce();
  });

  it('非capture hoverは遮蔽時にSurfaceをactiveにしない', () => {
    const { canvas, routePoint, router } = createHarness();
    routePoint.mockReturnValue(undefined);

    canvas.dispatchEvent(pointer('pointermove'));

    expect(router.getDebugState().surfaceId).toBeUndefined();
  });

  it('unregisterでSurface sessionをpointercancelして解放する', () => {
    const { button, canvas, router, surface } = createHarness();
    const cancel = vi.fn();
    button.addEventListener('pointercancel', cancel);
    canvas.dispatchEvent(pointer('pointerdown', {
      pointerId: 9,
      buttons: 1,
    }));

    router.unregisterSurface(surface);

    expect(cancel).toHaveBeenCalledOnce();
    expect(router.getDebugState().capturedPointerId).toBeUndefined();
    expect(surface.element.inert).toBe(true);
  });

  it('Surface DOMへ届いたnative pointerdownを複製しない', () => {
    const { button } = createHarness({
      forwardCanvasEventsThroughHost: true,
    });
    const down = vi.fn();
    button.addEventListener('pointerdown', down);

    button.dispatchEvent(pointer('pointerdown', {
      pointerId: 11,
      buttons: 1,
    }));

    expect(down).toHaveBeenCalledOnce();
  });

  it('disposeでlistenerと全sessionを解放する', () => {
    const { canvas, routePoint, router } = createHarness();
    canvas.dispatchEvent(pointer('pointerdown', {
      pointerId: 13,
      buttons: 1,
    }));
    router.dispose();
    const calls = routePoint.mock.calls.length;

    canvas.dispatchEvent(pointer('pointermove', {
      pointerId: 13,
      buttons: 1,
    }));

    expect(routePoint).toHaveBeenCalledTimes(calls);
    expect(router.getDebugState().capturedPointerId).toBeUndefined();
  });
});
