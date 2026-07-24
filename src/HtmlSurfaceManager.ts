import {
  Material,
  Mesh,
  Object3D,
  Raycaster,
  Vector2,
  type Camera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';

import {
  createHtmlTextureBackend,
  type BackendKind,
  type HtmlTextureBackend,
  type HtmlTextureHandle,
} from './backends/html-texture-backend';
import {
  copyAndTransformUv,
  uvToDomPoint,
  type DomPoint,
  type UvPoint,
} from './core/coordinates';
import { resolveFrontmostHit } from './core/hit-test';

const PARKED_TRANSFORM = 'translate(-100000px, 0)';
const STOPPED_EVENTS = [
  'click',
  'contextmenu',
  'dblclick',
  'pointerdown',
  'pointermove',
  'pointerup',
] as const;

export type HtmlSurfaceOptions = {
  id?: string;
  element: HTMLElement;
  mesh: Mesh;
  material?: Material;
  materialIndex?: number;
  mapProperty?: string;
  transformUv?: (uv: Vector2, texture: Texture) => void;
  disposeMaterial?: boolean;
  disposeGeometry?: boolean;
};

export type HtmlSurface = {
  readonly id: string;
  readonly element: HTMLElement;
  readonly mesh: Mesh;
  readonly texture: Texture;
  invalidate(): void;
  dispose(): void;
};

export type HtmlSurfaceDebugState = {
  kind: 'none' | 'blocked' | 'surface';
  objectName?: string;
  surfaceId?: string;
  uv?: UvPoint;
  domPoint?: DomPoint;
};

export type HtmlSurfaceManagerOptions = {
  renderer: WebGLRenderer;
  camera: Camera;
  scene: Scene;
  backend?: HtmlTextureBackend;
  onDebugChange?: (state: HtmlSurfaceDebugState) => void;
};

type MaterialRecord = Material & {
  [key: string]: unknown;
};

type SurfaceRecord = {
  id: string;
  element: HTMLElement;
  mesh: Mesh;
  material: MaterialRecord;
  mapProperty: string;
  previousMap: unknown;
  textureHandle: HtmlTextureHandle;
  transformUv?: HtmlSurfaceOptions['transformUv'];
  disposeMaterial: boolean;
  disposeGeometry: boolean;
  eventCleanup: Array<() => void>;
  disposed: boolean;
  api: HtmlSurface;
};

export class HtmlSurfaceManager {
  readonly backendKind: BackendKind;

  private readonly renderer: WebGLRenderer;
  private readonly camera: Camera;
  private readonly scene: Scene;
  private readonly backend: HtmlTextureBackend;
  private readonly onDebugChange?: (state: HtmlSurfaceDebugState) => void;
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly surfaces = new Set<SurfaceRecord>();
  private readonly surfacesByMesh = new Map<Object3D, SurfaceRecord>();
  private readonly canvasCleanup: Array<() => void> = [];

  private idSequence = 0;
  private disposed = false;
  private lastPointer: { clientX: number; clientY: number } | undefined;
  private debugState: HtmlSurfaceDebugState = { kind: 'none' };

  constructor(options: HtmlSurfaceManagerOptions) {
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.scene = options.scene;
    this.backend = options.backend
      ?? createHtmlTextureBackend({
        sourceCanvas: options.renderer.domElement,
      });
    this.backendKind = this.backend.kind;
    this.onDebugChange = options.onDebugChange;

    this.connectCanvasEvents();
  }

  add(options: HtmlSurfaceOptions): HtmlSurface {
    this.assertActive();

    const material = this.resolveMaterial(options);
    const mapProperty = options.mapProperty ?? 'map';
    const previousMap = material[mapProperty];
    const textureHandle = this.backend.mount(options.element);
    const id = options.id ?? `html-surface-${++this.idSequence}`;

    options.element.dataset.htmlSurfaceId = id;
    Object.assign(options.element.style, {
      left: '0',
      position: 'absolute',
      pointerEvents: 'auto',
      top: '0',
      transform: PARKED_TRANSFORM,
      transformOrigin: '0 0',
      willChange: 'transform',
    });

    const record = {} as SurfaceRecord;
    const api: HtmlSurface = {
      id,
      element: options.element,
      mesh: options.mesh,
      texture: textureHandle.texture,
      invalidate: textureHandle.invalidate,
      dispose: () => this.removeRecord(record),
    };

    Object.assign(record, {
      id,
      element: options.element,
      mesh: options.mesh,
      material,
      mapProperty,
      previousMap,
      textureHandle,
      transformUv: options.transformUv,
      disposeMaterial: options.disposeMaterial ?? false,
      disposeGeometry: options.disposeGeometry ?? false,
      eventCleanup: [],
      disposed: false,
      api,
    } satisfies SurfaceRecord);

    material[mapProperty] = textureHandle.texture;
    material.needsUpdate = true;

    this.surfaces.add(record);
    this.surfacesByMesh.set(options.mesh, record);
    this.connectSurfaceEvents(record);
    textureHandle.invalidate();

    return api;
  }

  update(): void {
    if (this.disposed || !this.lastPointer) {
      return;
    }

    this.routePointer(this.lastPointer.clientX, this.lastPointer.clientY);
  }

  getDebugState(): HtmlSurfaceDebugState {
    return {
      ...this.debugState,
      uv: this.debugState.uv ? { ...this.debugState.uv } : undefined,
      domPoint: this.debugState.domPoint
        ? { ...this.debugState.domPoint }
        : undefined,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    for (const cleanup of this.canvasCleanup.splice(0)) {
      cleanup();
    }
    for (const surface of [...this.surfaces]) {
      this.removeRecord(surface);
    }
    this.lastPointer = undefined;
    this.publishDebug({ kind: 'none' });
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error('HtmlSurfaceManager has already been disposed.');
    }
  }

  private resolveMaterial(options: HtmlSurfaceOptions): MaterialRecord {
    if (options.material) {
      return options.material as MaterialRecord;
    }

    const meshMaterial = options.mesh.material;
    if (Array.isArray(meshMaterial)) {
      const material = meshMaterial[options.materialIndex ?? 0];
      if (!material) {
        throw new Error('The selected materialIndex does not exist.');
      }
      return material as MaterialRecord;
    }

    if (!meshMaterial) {
      throw new Error('An HTML Surface requires a target Material.');
    }

    return meshMaterial as MaterialRecord;
  }

  private connectCanvasEvents(): void {
    const canvas = this.renderer.domElement;

    const onPointerMove = (event: PointerEvent) => {
      this.lastPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      this.routePointer(event.clientX, event.clientY);
    };

    const onPointerDown = (event: PointerEvent) => {
      this.lastPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      const surface = this.routePointer(event.clientX, event.clientY);
      if (surface && event.target === canvas) {
        event.stopImmediatePropagation();
      }
    };

    const onWheel = (event: WheelEvent) => {
      this.lastPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      const surface = this.routePointer(event.clientX, event.clientY);
      if (!surface || surface.element.contains(event.target as Node)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      this.scrollSurfaceAtPoint(surface, event);
    };

    canvas.addEventListener('pointermove', onPointerMove, true);
    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('wheel', onWheel, {
      capture: true,
      passive: false,
    });

    this.canvasCleanup.push(
      () => canvas.removeEventListener('pointermove', onPointerMove, true),
      () => canvas.removeEventListener('pointerdown', onPointerDown, true),
      () => canvas.removeEventListener('wheel', onWheel, true),
    );
  }

  private connectSurfaceEvents(surface: SurfaceRecord): void {
    const stopBubble = (event: Event) => {
      event.stopPropagation();
    };
    for (const eventName of STOPPED_EVENTS) {
      surface.element.addEventListener(eventName, stopBubble);
      surface.eventCleanup.push(() => {
        surface.element.removeEventListener(eventName, stopBubble);
      });
    }

    const guardPointer = (event: PointerEvent) => {
      this.lastPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      const targetSurface = this.routePointer(event.clientX, event.clientY);
      if (targetSurface !== surface) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    for (const eventName of ['pointerdown', 'pointerup', 'click'] as const) {
      surface.element.addEventListener(eventName, guardPointer, true);
      surface.eventCleanup.push(() => {
        surface.element.removeEventListener(eventName, guardPointer, true);
      });
    }

    const onSurfacePointerMove = (event: PointerEvent) => {
      this.lastPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      this.routePointer(event.clientX, event.clientY);
    };
    surface.element.addEventListener('pointermove', onSurfacePointerMove, true);
    surface.eventCleanup.push(() => {
      surface.element.removeEventListener(
        'pointermove',
        onSurfacePointerMove,
        true,
      );
    });

    const onWheel = (event: WheelEvent) => {
      const targetSurface = this.routePointer(event.clientX, event.clientY);
      if (targetSurface !== surface) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.stopPropagation();
      queueMicrotask(surface.textureHandle.invalidate);
    };
    surface.element.addEventListener('wheel', onWheel, {
      capture: true,
      passive: false,
    });
    surface.eventCleanup.push(() => {
      surface.element.removeEventListener('wheel', onWheel, true);
    });
  }

  private routePointer(
    clientX: number,
    clientY: number,
  ): SurfaceRecord | undefined {
    if (this.disposed) {
      return undefined;
    }

    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    if (
      clientX < canvasRect.left
      || clientX > canvasRect.right
      || clientY < canvasRect.top
      || clientY > canvasRect.bottom
    ) {
      this.parkAll();
      this.publishDebug({ kind: 'none' });
      return undefined;
    }

    this.pointerNdc.set(
      ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
      -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const intersections = this.raycaster
      .intersectObjects(this.scene.children, true)
      .map((hit) => ({
        distance: hit.distance,
        object: hit.object,
        uv: hit.uv ? { x: hit.uv.x, y: hit.uv.y } : undefined,
      }));

    const result = resolveFrontmostHit(
      intersections,
      (object) => this.findSurfaceForObject(object),
      (object) => this.shouldIgnoreObject(object),
    );

    if (result.kind === 'none') {
      this.parkAll();
      this.publishDebug({ kind: 'none' });
      return undefined;
    }

    if (result.kind === 'blocked') {
      this.parkAll();
      this.publishDebug({
        kind: 'blocked',
        objectName: result.hit.object.name || result.hit.object.type,
      });
      return undefined;
    }

    const surface = result.surface;
    const transformedUv = copyAndTransformUv(result.uv, (uv) => {
      const vector = new Vector2(uv.x, uv.y);
      if (surface.transformUv) {
        surface.transformUv(vector, surface.textureHandle.texture);
      } else {
        surface.textureHandle.texture.transformUv(vector);
      }
      uv.x = vector.x;
      uv.y = vector.y;
    });

    const size = {
      width: surface.element.offsetWidth,
      height: surface.element.offsetHeight,
    };
    if (size.width === 0 || size.height === 0) {
      this.parkAll();
      this.publishDebug({
        kind: 'blocked',
        objectName: surface.mesh.name || surface.mesh.type,
      });
      return undefined;
    }

    const domPoint = uvToDomPoint(transformedUv, size);
    const canvasX = clientX - canvasRect.left;
    const canvasY = clientY - canvasRect.top;
    this.activateSurface(surface, {
      x: canvasX - domPoint.x,
      y: canvasY - domPoint.y,
    });
    this.publishDebug({
      kind: 'surface',
      objectName: result.hit.object.name || result.hit.object.type,
      surfaceId: surface.id,
      uv: transformedUv,
      domPoint,
    });

    return surface;
  }

  private findSurfaceForObject(
    object: Object3D,
  ): SurfaceRecord | undefined {
    let current: Object3D | null = object;
    while (current) {
      const surface = this.surfacesByMesh.get(current);
      if (surface) {
        return surface;
      }
      current = current.parent;
    }
    return undefined;
  }

  private shouldIgnoreObject(object: Object3D): boolean {
    if (object.userData.htmlSurfaceRaycast === 'ignore') {
      return true;
    }

    if (object.visible === false) {
      return true;
    }

    const candidate = object as Mesh;
    const material = candidate.material;
    if (Array.isArray(material)) {
      return material.every((item) => item.visible === false);
    }

    return material instanceof Material && material.visible === false;
  }

  private activateSurface(
    activeSurface: SurfaceRecord,
    translation: DomPoint,
  ): void {
    for (const surface of this.surfaces) {
      surface.element.style.transform = surface === activeSurface
        ? `translate(${translation.x}px, ${translation.y}px)`
        : PARKED_TRANSFORM;
    }
  }

  private parkAll(): void {
    for (const surface of this.surfaces) {
      surface.element.style.transform = PARKED_TRANSFORM;
    }
  }

  private scrollSurfaceAtPoint(
    surface: SurfaceRecord,
    event: WheelEvent,
  ): void {
    let node = document.elementFromPoint(event.clientX, event.clientY);
    while (node && surface.element.contains(node)) {
      if (node instanceof HTMLElement) {
        const style = getComputedStyle(node);
        const canScrollY = (
          node.scrollHeight > node.clientHeight
          && ['auto', 'scroll'].includes(style.overflowY)
        );
        if (canScrollY) {
          node.scrollTop += event.deltaY;
          surface.textureHandle.invalidate();
          return;
        }
      }
      node = node.parentElement;
    }

    if (surface.element.scrollHeight > surface.element.clientHeight) {
      surface.element.scrollTop += event.deltaY;
      surface.textureHandle.invalidate();
    }
  }

  private publishDebug(state: HtmlSurfaceDebugState): void {
    this.debugState = state;
    this.onDebugChange?.(this.getDebugState());
  }

  private removeRecord(surface: SurfaceRecord): void {
    if (surface.disposed) {
      return;
    }

    surface.disposed = true;
    this.surfaces.delete(surface);
    this.surfacesByMesh.delete(surface.mesh);
    for (const cleanup of surface.eventCleanup.splice(0)) {
      cleanup();
    }

    if (surface.material[surface.mapProperty] === surface.textureHandle.texture) {
      surface.material[surface.mapProperty] = surface.previousMap;
      surface.material.needsUpdate = true;
    }

    surface.textureHandle.dispose();
    if (surface.disposeMaterial) {
      surface.material.dispose();
    }
    if (surface.disposeGeometry) {
      surface.mesh.geometry.dispose();
    }
  }
}
