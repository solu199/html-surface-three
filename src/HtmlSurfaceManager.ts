import {
  Material,
  Mesh,
  Raycaster,
  Vector2,
  type Camera,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';

import {
  createHtmlTextureBackend,
  type BackendKind,
  type BackendPreference,
  type HtmlTextureBackend,
  type HtmlTextureHandle,
} from './backends/html-texture-backend';
import {
  createCapabilityReport,
  type CapabilityReport,
} from './core/capabilities';
import {
  copyAndTransformUv,
  uvToDomPoint,
  type DomPoint,
  type UvPoint,
} from './core/coordinates';
import { resolveFrontmostHit } from './core/hit-test';
import { HtmlSurfaceError } from './core/errors';
import {
  MaterialBindingClaims,
  bindSurfaceTexture,
  type MaterialBinding,
} from './core/material-binding';
import {
  SurfaceRegistry,
  type SurfaceRegistration,
} from './core/surface-registry';

const PARKED_TRANSFORM = 'translate(-100000px, 0)';
const STOPPED_EVENTS = [
  'click',
  'contextmenu',
  'dblclick',
  'pointerdown',
  'pointermove',
  'pointerup',
] as const;

function captureElementStyle(element: HTMLElement): ElementStyleSnapshot {
  return {
    htmlSurfaceId: element.getAttribute('data-html-surface-id'),
    left: element.style.left,
    position: element.style.position,
    pointerEvents: element.style.pointerEvents,
    top: element.style.top,
    transform: element.style.transform,
    transformOrigin: element.style.transformOrigin,
    willChange: element.style.willChange,
  };
}

function restoreElementStyle(
  element: HTMLElement,
  snapshot: ElementStyleSnapshot,
): void {
  if (snapshot.htmlSurfaceId === null) {
    element.removeAttribute('data-html-surface-id');
  } else {
    element.setAttribute('data-html-surface-id', snapshot.htmlSurfaceId);
  }
  Object.assign(element.style, {
    left: snapshot.left,
    position: snapshot.position,
    pointerEvents: snapshot.pointerEvents,
    top: snapshot.top,
    transform: snapshot.transform,
    transformOrigin: snapshot.transformOrigin,
    willChange: snapshot.willChange,
  });
}

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
  enabled?: boolean;
};

export type HtmlSurface = {
  readonly id: string;
  readonly element: HTMLElement;
  readonly mesh: Mesh;
  readonly texture: Texture;
  readonly enabled: boolean;
  readonly ready: Promise<void>;
  invalidate(): void;
  setEnabled(enabled: boolean): void;
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
  backend?: BackendPreference | HtmlTextureBackend;
  onDebugChange?: (state: HtmlSurfaceDebugState) => void;
};

type ElementStyleSnapshot = {
  htmlSurfaceId: string | null;
  left: string;
  position: string;
  pointerEvents: string;
  top: string;
  transform: string;
  transformOrigin: string;
  willChange: string;
};

type SurfaceRecord = SurfaceRegistration & {
  id: string;
  element: HTMLElement;
  mesh: Mesh;
  materialIndex: number;
  enabled: boolean;
  binding: MaterialBinding;
  textureHandle: HtmlTextureHandle;
  transformUv?: HtmlSurfaceOptions['transformUv'];
  elementSnapshot: ElementStyleSnapshot;
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
  private readonly capabilities: CapabilityReport;
  private readonly onDebugChange?: (state: HtmlSurfaceDebugState) => void;
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly bindingClaims = new MaterialBindingClaims();
  private readonly registry = new SurfaceRegistry<SurfaceRecord>();
  private readonly canvasCleanup: Array<() => void> = [];

  private idSequence = 0;
  private disposed = false;
  private lastPointer: { clientX: number; clientY: number } | undefined;
  private debugState: HtmlSurfaceDebugState = { kind: 'none' };

  constructor(options: HtmlSurfaceManagerOptions) {
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.scene = options.scene;
    const backendOption = options.backend ?? 'auto';
    const requestedBackend: BackendPreference =
      typeof backendOption === 'string'
        ? backendOption
        : backendOption.kind;
    this.backend = typeof backendOption === 'string'
      ? createHtmlTextureBackend({
        sourceCanvas: options.renderer.domElement,
        preference: backendOption,
      })
      : backendOption;
    this.backendKind = this.backend.kind;
    this.onDebugChange = options.onDebugChange;
    this.capabilities = createCapabilityReport({
      requested: requestedBackend,
      active: this.backend.kind,
      nativeAvailable: this.backend.nativeAvailable,
      pointerEvents: typeof globalThis.PointerEvent !== 'undefined',
      pointerCapture: 'setPointerCapture' in options.renderer.domElement,
      touch: (
        'ontouchstart' in globalThis
        || (globalThis.navigator?.maxTouchPoints ?? 0) > 0
      ),
      webgl: true,
    });

    this.connectCanvasEvents();
  }

  add(options: HtmlSurfaceOptions): HtmlSurface {
    this.assertActive();

    const id = options.id ?? `html-surface-${++this.idSequence}`;
    if (this.registry.hasId(id)) {
      throw new HtmlSurfaceError(
        'duplicate-surface-id',
        `HTML Surface ID "${id}"は既に使用されています。`,
      );
    }

    let textureHandle: HtmlTextureHandle;
    try {
      textureHandle = this.backend.mount(options.element);
    } catch (cause) {
      throw new HtmlSurfaceError(
        'backend-initialization-failed',
        'HTML Texture Backendを初期化できませんでした。',
        { cause },
      );
    }

    let binding: MaterialBinding;
    try {
      binding = bindSurfaceTexture({
        mesh: options.mesh,
        material: options.material,
        materialIndex: options.materialIndex,
        mapProperty: options.mapProperty,
        texture: textureHandle.texture,
        disposeMaterial: options.disposeMaterial,
        disposeGeometry: options.disposeGeometry,
      }, this.bindingClaims);
    } catch (error) {
      textureHandle.dispose();
      throw error;
    }

    const elementSnapshot = captureElementStyle(options.element);
    options.element.dataset.htmlSurfaceId = id;
    Object.assign(options.element.style, {
      left: '0',
      position: 'absolute',
      pointerEvents: options.enabled === false ? 'none' : 'auto',
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
      get enabled() {
        return record.enabled;
      },
      ready: textureHandle.ready,
      invalidate: () => {
        if (!record.disposed) {
          textureHandle.invalidate();
        }
      },
      setEnabled: (enabled) => {
        if (record.disposed) {
          throw new HtmlSurfaceError(
            'surface-disposed',
            `HTML Surface "${record.id}"は既に破棄されています。`,
          );
        }
        record.enabled = enabled;
        record.element.style.pointerEvents = enabled ? 'auto' : 'none';
        if (!enabled) {
          record.element.style.transform = PARKED_TRANSFORM;
        }
      },
      dispose: () => this.removeRecord(record),
    };

    Object.assign(record, {
      id,
      element: options.element,
      mesh: options.mesh,
      materialIndex: binding.materialIndex,
      enabled: options.enabled ?? true,
      binding,
      textureHandle,
      transformUv: options.transformUv,
      elementSnapshot,
      eventCleanup: [],
      disposed: false,
      api,
    } satisfies SurfaceRecord);

    this.registry.add(record);
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

  getCapabilityReport(): CapabilityReport {
    return {
      ...this.capabilities,
      backend: { ...this.capabilities.backend },
      input: { ...this.capabilities.input },
      rendering: { ...this.capabilities.rendering },
      warnings: Object.freeze([...this.capabilities.warnings]),
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
    for (const surface of this.registry.values()) {
      this.removeRecord(surface);
    }
    this.lastPointer = undefined;
    this.publishDebug({ kind: 'none' });
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new HtmlSurfaceError(
        'manager-disposed',
        'HtmlSurfaceManagerは既に破棄されています。',
      );
    }
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
        materialIndex: hit.face?.materialIndex,
        uv: hit.uv ? { x: hit.uv.x, y: hit.uv.y } : undefined,
      }));

    const result = resolveFrontmostHit(
      intersections,
      (object, materialIndex) => (
        this.registry.resolve(object, materialIndex ?? 0)
      ),
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
    for (const surface of this.registry.values()) {
      surface.element.style.transform = surface === activeSurface
        ? `translate(${translation.x}px, ${translation.y}px)`
        : PARKED_TRANSFORM;
    }
  }

  private parkAll(): void {
    for (const surface of this.registry.values()) {
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
    this.registry.remove(surface);
    for (const cleanup of surface.eventCleanup.splice(0)) {
      cleanup();
    }

    surface.binding.restore();
    surface.textureHandle.dispose();
    surface.binding.disposeOwnedResources();
    restoreElementStyle(surface.element, surface.elementSnapshot);
  }
}
