import {
  Mesh,
  Vector3,
  type Camera,
  type WebGLRenderer,
} from 'three';

import type {
  CapabilityReport,
  HtmlSurfaceDebugState,
} from '../index';

export type DemoTestState = {
  animationTime: number;
  paused: boolean;
  occluded: boolean;
  capabilities: CapabilityReport;
  debug: HtmlSurfaceDebugState;
};

export type DemoTestApi = {
  readonly ready: Promise<void>;
  setAnimationTime(seconds: number): void;
  setAnimationPaused(paused: boolean): void;
  setOccluded(occluded: boolean): void;
  pointFor(
    testId: string,
    xRatio?: number,
    yRatio?: number,
  ): {
    x: number;
    y: number;
  };
  getState(): DemoTestState;
};

declare global {
  interface Window {
    __HTML_SURFACE_DEMO__?: DemoTestApi;
  }
}

export function projectDomTarget(options: {
  root: HTMLElement;
  testId: string;
  screen: Mesh;
  camera: Camera;
  renderer: WebGLRenderer;
  xRatio?: number;
  yRatio?: number;
}): {
  x: number;
  y: number;
} {
  const target = options.root.querySelector<HTMLElement>(
    `[data-testid="${options.testId}"]`,
  );
  if (!target) {
    throw new Error(`Unknown demo test target: ${options.testId}`);
  }

  const rootRect = options.root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (rootRect.width === 0 || rootRect.height === 0) {
    throw new Error('Demo Surface source has zero size.');
  }

  const x = (
    targetRect.left
    - rootRect.left
    + targetRect.width * (options.xRatio ?? 0.5)
  );
  const y = (
    targetRect.top
    - rootRect.top
    + targetRect.height * (options.yRatio ?? 0.5)
  );
  const u = x / rootRect.width;
  const v = 1 - y / rootRect.height;
  const geometry = options.screen.geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) {
    throw new Error('Monitor screen has no bounding box.');
  }

  const point = new Vector3(
    box.min.x + (box.max.x - box.min.x) * u,
    box.min.y + (box.max.y - box.min.y) * v,
    0,
  );
  options.screen.localToWorld(point);
  point.project(options.camera);
  const canvas = options.renderer.domElement.getBoundingClientRect();

  return {
    x: canvas.left + (point.x + 1) * canvas.width / 2,
    y: canvas.top + (1 - point.y) * canvas.height / 2,
  };
}
