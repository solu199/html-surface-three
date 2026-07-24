// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import {
  installCanvasActivationGuard,
} from '../src/input/dom-activation';
import { activateDomTarget } from '../src/input/dom-target';

function captureOf(
  options?: boolean | AddEventListenerOptions | EventListenerOptions,
): boolean {
  return typeof options === 'boolean'
    ? options
    : options?.capture ?? false;
}

function forwardCanvasClickListeners(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
): void {
  const forwarded = new WeakMap<
    EventListenerOrEventListenerObject,
    Map<boolean, EventListener>
  >();
  const nativeAdd = canvas.addEventListener.bind(canvas);
  const nativeRemove = canvas.removeEventListener.bind(canvas);

  Object.defineProperties(canvas, {
    addEventListener: {
      configurable: true,
      writable: true,
      value(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (!listener) {
          return;
        }
        nativeAdd(type, listener, options);
        if (type !== 'click') {
          return;
        }

        const capture = captureOf(options);
        const hostListener: EventListener = (event) => {
          if (typeof listener === 'function') {
            listener.call(canvas, event);
          } else {
            listener.handleEvent(event);
          }
        };
        const byCapture = forwarded.get(listener) ?? new Map();
        byCapture.set(capture, hostListener);
        forwarded.set(listener, byCapture);
        host.addEventListener(type, hostListener, options);
      },
    },
    removeEventListener: {
      configurable: true,
      writable: true,
      value(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
      ) {
        if (!listener) {
          return;
        }
        nativeRemove(type, listener, options);
        if (type !== 'click') {
          return;
        }

        const capture = captureOf(options);
        const hostListener = forwarded.get(listener)?.get(capture);
        if (hostListener) {
          host.removeEventListener(type, hostListener, options);
        }
      },
    },
  });
}

describe('DOM activation canvas guard', () => {
  it('routed activationだけpolyfill host上のcanvas click listenerから隔離する', () => {
    const canvas = document.createElement('canvas');
    const host = document.createElement('div');
    const root = document.createElement('div');
    const button = document.createElement('button');
    root.append(button);
    host.append(root);
    document.body.append(canvas, host);
    forwardCanvasClickListeners(canvas, host);

    expect(installCanvasActivationGuard(canvas)).toBe(true);
    expect(installCanvasActivationGuard(canvas)).toBe(false);

    const canvasBridge = vi.fn((event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    const buttonClick = vi.fn();
    canvas.addEventListener('click', canvasBridge, true);
    button.addEventListener('click', buttonClick);

    expect(activateDomTarget(button)).toBe(true);
    expect(buttonClick).toHaveBeenCalledOnce();
    expect(canvasBridge).not.toHaveBeenCalled();

    button.click();
    expect(canvasBridge).toHaveBeenCalledOnce();
    expect(buttonClick).toHaveBeenCalledOnce();

    canvas.removeEventListener('click', canvasBridge, true);
    button.click();
    expect(canvasBridge).toHaveBeenCalledOnce();
    expect(buttonClick).toHaveBeenCalledTimes(2);
  });
});
