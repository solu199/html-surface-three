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
import type {
  HtmlTextureBackend,
  HtmlTextureHandle,
} from '../src/backends/html-texture-backend';

function createHarness() {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const handles: HtmlTextureHandle[] = [];
  const backend: HtmlTextureBackend = {
    kind: 'polyfill',
    nativeAvailable: false,
    requestPaint: vi.fn(),
    mount: vi.fn(() => {
      const handle: HtmlTextureHandle = {
        texture: new Texture(),
        ready: Promise.resolve(),
        invalidate: vi.fn(),
        dispose: vi.fn(),
      };
      handles.push(handle);
      return handle;
    }),
  };
  const manager = new HtmlSurfaceManager({
    renderer: { domElement: canvas } as never,
    camera: new PerspectiveCamera(),
    scene: new Scene(),
    backend,
  });

  return {
    backend,
    handles,
    manager,
  };
}

describe('HtmlSurfaceManager lifecycle', () => {
  it('Surfaceを無効化・再有効化し、破棄は冪等に行う', async () => {
    const { handles, manager } = createHarness();
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(new PlaneGeometry(), material);
    const element = document.createElement('div');
    element.style.position = 'relative';
    document.body.append(element);

    const surface = manager.add({
      id: 'panel',
      element,
      mesh,
    });

    await expect(surface.ready).resolves.toBeUndefined();
    surface.setEnabled(false);
    expect(surface.enabled).toBe(false);
    surface.setEnabled(true);
    expect(surface.enabled).toBe(true);
    surface.dispose();
    surface.dispose();

    expect(handles[0]?.dispose).toHaveBeenCalledOnce();
    expect(material.map).toBeNull();
    expect(element.isConnected).toBe(true);
    expect(element.style.position).toBe('relative');
    expect(element.dataset.htmlSurfaceId).toBeUndefined();
  });

  it('Surface破棄後のsetEnabledを型付きエラーにし、invalidateはno-opにする', () => {
    const { handles, manager } = createHarness();
    const surface = manager.add({
      element: document.createElement('div'),
      mesh: new Mesh(
        new PlaneGeometry(),
        new MeshBasicMaterial(),
      ),
    });
    surface.dispose();
    const invalidateCalls = vi.mocked(handles[0]!.invalidate).mock.calls.length;

    expect(() => surface.setEnabled(false)).toThrowError(
      expect.objectContaining({ code: 'surface-disposed' }),
    );
    surface.invalidate();
    expect(handles[0]?.invalidate).toHaveBeenCalledTimes(invalidateCalls);
  });

  it('Manager破棄後のaddを型付きエラーにする', () => {
    const { manager } = createHarness();
    manager.dispose();

    expect(() => manager.add({
      element: document.createElement('div'),
      mesh: new Mesh(
        new PlaneGeometry(),
        new MeshBasicMaterial(),
      ),
    })).toThrowError(
      expect.objectContaining({ code: 'manager-disposed' }),
    );
  });

  it('同じIDの二重登録をBackend mount前に拒否する', () => {
    const { backend, manager } = createHarness();
    manager.add({
      id: 'panel',
      element: document.createElement('div'),
      mesh: new Mesh(
        new PlaneGeometry(),
        new MeshBasicMaterial(),
      ),
    });

    expect(() => manager.add({
      id: 'panel',
      element: document.createElement('div'),
      mesh: new Mesh(
        new PlaneGeometry(),
        new MeshBasicMaterial(),
      ),
    })).toThrowError(
      expect.objectContaining({ code: 'duplicate-surface-id' }),
    );
    expect(backend.mount).toHaveBeenCalledOnce();
  });

  it('同じMeshの別Materialスロットへ別Surfaceを適用する', () => {
    const { handles, manager } = createHarness();
    const materials = [
      new MeshBasicMaterial(),
      new MeshBasicMaterial(),
    ];
    const mesh = new Mesh(new PlaneGeometry(), materials);

    manager.add({
      id: 'first',
      element: document.createElement('div'),
      mesh,
      materialIndex: 0,
    });
    manager.add({
      id: 'second',
      element: document.createElement('div'),
      mesh,
      materialIndex: 1,
    });

    expect(materials[0]?.map).toBe(handles[0]?.texture);
    expect(materials[1]?.map).toBe(handles[1]?.texture);
  });

  it('Backend mount失敗を型付きエラーへ包む', () => {
    const { backend, manager } = createHarness();
    vi.mocked(backend.mount).mockImplementationOnce(() => {
      throw new Error('paint unavailable');
    });

    expect(() => manager.add({
      element: document.createElement('div'),
      mesh: new Mesh(
        new PlaneGeometry(),
        new MeshBasicMaterial(),
      ),
    })).toThrowError(
      expect.objectContaining({
        code: 'backend-initialization-failed',
        cause: expect.any(Error),
      }),
    );
  });

  it('CapabilityReportを防御的コピーで返す', () => {
    const { manager } = createHarness();
    const first = manager.getCapabilityReport();
    const second = manager.getCapabilityReport();

    expect(first.backend.active).toBe('polyfill');
    expect(first.backend.requested).toBe('polyfill');
    expect(Object.isFrozen(first.warnings)).toBe(true);
    expect(first).not.toBe(second);
    expect(first.backend).not.toBe(second.backend);
  });
});
