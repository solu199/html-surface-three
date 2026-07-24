import { describe, expect, it } from 'vitest';

import { PointerSessionStore } from '../src/input/pointer-session';

type Surface = {
  id: string;
};

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
      pointerId: 1,
      pointerType: 'mouse',
      surface: first,
      target: {} as Element,
      source: 'dom',
    });
    store.start({
      pointerId: 2,
      pointerType: 'touch',
      surface: first,
      target: {} as Element,
      source: 'canvas',
    });
    store.start({
      pointerId: 3,
      pointerType: 'pen',
      surface: second,
      target: {} as Element,
      source: 'canvas',
    });

    expect(store.finish(1)?.pointerId).toBe(1);
    expect(
      store.cancelSurface(first).map((item) => item.pointerId),
    ).toEqual([2]);
    expect(
      store.values().map((item) => item.pointerId),
    ).toEqual([3]);
  });

  it('同じpointerIdの再開始は古いsessionを置き換える', () => {
    const store = new PointerSessionStore<Surface>();
    const first = { id: 'first' };
    const second = { id: 'second' };
    store.start({
      pointerId: 1,
      pointerType: 'mouse',
      surface: first,
      target: {} as Element,
      source: 'dom',
    });
    store.start({
      pointerId: 1,
      pointerType: 'mouse',
      surface: second,
      target: {} as Element,
      source: 'canvas',
    });

    expect(store.get(1)?.surface).toBe(second);
  });
});
