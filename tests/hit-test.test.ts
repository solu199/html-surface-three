import { describe, expect, it } from 'vitest';

import { resolveFrontmostHit } from '../src/core/hit-test';

type ObjectRef = {
  name: string;
  ignored?: boolean;
};

type SurfaceRef = {
  id: string;
};

const panel: ObjectRef = { name: 'panel' };
const blocker: ObjectRef = { name: 'blocker' };
const surface: SurfaceRef = { id: 'panel-surface' };

const resolveSurface = (object: ObjectRef) => (
  object === panel ? surface : undefined
);

const shouldIgnore = (object: ObjectRef) => object.ignored === true;

describe('resolveFrontmostHit', () => {
  it('最前面がSurfaceならUV付きSurface hitを返す', () => {
    const result = resolveFrontmostHit(
      [{ distance: 1, object: panel, uv: { x: 0.4, y: 0.6 } }],
      resolveSurface,
      shouldIgnore,
    );

    expect(result).toEqual({
      kind: 'surface',
      hit: {
        distance: 1,
        object: panel,
        uv: { x: 0.4, y: 0.6 },
      },
      surface,
      uv: { x: 0.4, y: 0.6 },
    });
  });

  it('Surfaceより手前の通常Meshを遮蔽物として返す', () => {
    const result = resolveFrontmostHit(
      [
        { distance: 0.5, object: blocker, uv: { x: 0.1, y: 0.1 } },
        { distance: 1, object: panel, uv: { x: 0.4, y: 0.6 } },
      ],
      resolveSurface,
      shouldIgnore,
    );

    expect(result).toEqual({
      kind: 'blocked',
      hit: {
        distance: 0.5,
        object: blocker,
        uv: { x: 0.1, y: 0.1 },
      },
    });
  });

  it('ignore指定の交差を飛ばす', () => {
    const helper: ObjectRef = { name: 'helper', ignored: true };
    const result = resolveFrontmostHit(
      [
        { distance: 0.2, object: helper },
        { distance: 1, object: panel, uv: { x: 0.4, y: 0.6 } },
      ],
      resolveSurface,
      shouldIgnore,
    );

    expect(result.kind).toBe('surface');
  });

  it('UVを持たないSurfaceは入力対象にしない', () => {
    const result = resolveFrontmostHit(
      [{ distance: 1, object: panel }],
      resolveSurface,
      shouldIgnore,
    );

    expect(result.kind).toBe('blocked');
  });

  it('交差面のMaterialスロットをSurface解決へ渡す', () => {
    const slots: Array<number | undefined> = [];

    resolveFrontmostHit(
      [{
        distance: 1,
        object: panel,
        materialIndex: 2,
        uv: { x: 0.5, y: 0.5 },
      }],
      (object, materialIndex) => {
        slots.push(materialIndex);
        return object === panel ? surface : undefined;
      },
      shouldIgnore,
    );

    expect(slots).toEqual([2]);
  });
});
