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
    setMetrics(inner, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 200,
    });
    setMetrics(outer, {
      clientHeight: 100,
      scrollHeight: 400,
      scrollTop: 20,
    });
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element) => ({
        overflowY: element === root ? 'visible' : 'auto',
        overflowX: 'visible',
      }) as CSSStyleDeclaration,
    );

    expect(findScrollableTarget(root, inner, 30)).toBe(outer);
    expect(findScrollableTarget(root, inner, -30)).toBe(inner);
  });

  it('deltaを適用し、実際にscrollできた時だけtrueを返す', () => {
    const element = document.createElement('div');
    setMetrics(element, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 20,
    });

    expect(applyWheelDelta(element, 40)).toBe(true);
    expect(element.scrollTop).toBe(60);
    element.scrollTop = 200;
    expect(applyWheelDelta(element, 40)).toBe(false);
    expect(element.scrollTop).toBe(200);
  });
});
