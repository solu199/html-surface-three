import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import { describe, expect, it } from 'vitest';

import { HtmlSurfaceError } from '../src/core/errors';
import { SurfaceRegistry } from '../src/core/surface-registry';

type Surface = {
  id: string;
  mesh: Mesh;
  materialIndex: number;
  enabled: boolean;
};

describe('SurfaceRegistry', () => {
  it('子Objectから親MeshのMaterialスロットに対応するSurfaceを返す', () => {
    const mesh = new Mesh(
      new PlaneGeometry(),
      [new MeshBasicMaterial(), new MeshBasicMaterial()],
    );
    const child = new Group();
    mesh.add(child);
    const first: Surface = {
      id: 'first',
      mesh,
      materialIndex: 0,
      enabled: true,
    };
    const second: Surface = {
      id: 'second',
      mesh,
      materialIndex: 1,
      enabled: true,
    };
    const registry = new SurfaceRegistry<Surface>();
    registry.add(first);
    registry.add(second);

    expect(registry.resolve(child, 1)).toBe(second);
  });

  it('無効Surfaceを返さない', () => {
    const mesh = new Mesh(
      new PlaneGeometry(),
      new MeshBasicMaterial(),
    );
    const surface: Surface = {
      id: 'disabled',
      mesh,
      materialIndex: 0,
      enabled: false,
    };
    const registry = new SurfaceRegistry<Surface>();
    registry.add(surface);

    expect(registry.resolve(mesh, 0)).toBeUndefined();
  });

  it('ID重複を拒否し、remove後は再登録できる', () => {
    const mesh = new Mesh(
      new PlaneGeometry(),
      new MeshBasicMaterial(),
    );
    const registry = new SurfaceRegistry<Surface>();
    const surface: Surface = {
      id: 'panel',
      mesh,
      materialIndex: 0,
      enabled: true,
    };
    registry.add(surface);

    expect(() => registry.add({ ...surface })).toThrowError(HtmlSurfaceError);
    registry.remove(surface);
    expect(() => registry.add({ ...surface })).not.toThrow();
  });
});
