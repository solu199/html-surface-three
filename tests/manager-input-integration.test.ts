// @vitest-environment happy-dom

import {
  BoxGeometry,
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

function pointer(
  type: string,
  pointerId: number,
): PointerEvent {
  return new PointerEvent(type, {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 400,
    clientY: 300,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    bubbles: true,
    cancelable: true,
  });
}

function createHarness() {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON() {},
    }),
  });
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
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 800 / 600, 0.1, 100);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const screen = new Mesh(
    new PlaneGeometry(2, 1.5),
    new MeshBasicMaterial(),
  );
  screen.name = 'screen';
  scene.add(screen);
  scene.updateMatrixWorld(true);
  const manager = new HtmlSurfaceManager({
    renderer: { domElement: canvas } as never,
    camera,
    scene,
    backend,
  });
  const root = document.createElement('div');
  const button = document.createElement('button');
  button.dataset.testid = 'action';
  root.append(button);
  document.body.append(root);
  Object.defineProperties(root, {
    offsetWidth: { configurable: true, value: 200 },
    offsetHeight: { configurable: true, value: 100 },
  });
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(button);
  const surface = manager.add({
    id: 'panel',
    element: root,
    mesh: screen,
  });

  return {
    backend,
    button,
    camera,
    canvas,
    manager,
    root,
    scene,
    screen,
    surface,
  };
}

describe('HtmlSurfaceManager input integration', () => {
  it('Canvas touchをRaycastしてDOM buttonへ配送し、通常Meshで遮蔽する', () => {
    const { button, canvas, scene } = createHarness();
    const click = vi.fn();
    button.addEventListener('click', click);

    canvas.dispatchEvent(pointer('pointerdown', 1));
    canvas.dispatchEvent(pointer('pointerup', 1));
    expect(click).toHaveBeenCalledOnce();

    const blocker = new Mesh(
      new BoxGeometry(1, 1, 0.2),
      new MeshBasicMaterial(),
    );
    blocker.name = 'blocker';
    blocker.position.z = 1;
    scene.add(blocker);
    scene.updateMatrixWorld(true);
    canvas.dispatchEvent(pointer('pointerdown', 2));
    canvas.dispatchEvent(pointer('pointerup', 2));

    expect(click).toHaveBeenCalledOnce();
  });

  it('Surface無効化と破棄でinertとactive pointer sessionを解放する', () => {
    const { canvas, manager, root, surface } = createHarness();
    canvas.dispatchEvent(pointer('pointerdown', 9));
    expect(manager.getDebugState().capturedPointerId).toBe(9);

    surface.setEnabled(false);
    expect(root.inert).toBe(true);
    expect(manager.getDebugState().capturedPointerId).toBeUndefined();

    surface.setEnabled(true);
    expect(surface.enabled).toBe(true);
    surface.dispose();
    expect(root.inert).toBe(false);
    expect(manager.getDebugState().capturedPointerId).toBeUndefined();
  });
});
