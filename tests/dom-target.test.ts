// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import {
  activateDomTarget,
  dispatchPointerClone,
  focusDomTarget,
  isSyntheticPointerEvent,
  resolveDomTarget,
} from '../src/input/dom-target';

describe('DOM input target helpers', () => {
  it('elementFromPointがSurface内の要素だけを返す', () => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    root.append(button);
    document.body.append(root);
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

  it('PointerEventの主要プロパティを複製してsynthetic印付きで配送する', () => {
    const target = document.createElement('div');
    const events: PointerEvent[] = [];
    target.addEventListener('pointerdown', (event) => {
      events.push(event);
    });
    const source = new PointerEvent('pointerdown', {
      pointerId: 4,
      pointerType: 'touch',
      clientX: 30,
      clientY: 40,
      bubbles: true,
    });

    expect(
      dispatchPointerClone(target, 'pointerdown', source),
    ).toBe(true);

    expect(events).toHaveLength(1);
    expect(events[0]?.pointerId).toBe(4);
    expect(events[0]?.pointerType).toBe('touch');
    expect(events[0]?.clientX).toBe(30);
    expect(isSyntheticPointerEvent(events[0]!)).toBe(true);
    expect(isSyntheticPointerEvent(source)).toBe(false);
  });

  it('disabledでないHTMLElementだけをclick activationする', () => {
    const button = document.createElement('button');
    const click = vi.spyOn(button, 'click');

    expect(activateDomTarget(button)).toBe(true);
    expect(click).toHaveBeenCalledOnce();

    button.disabled = true;
    expect(activateDomTarget(button)).toBe(false);
    expect(click).toHaveBeenCalledOnce();
  });
});
