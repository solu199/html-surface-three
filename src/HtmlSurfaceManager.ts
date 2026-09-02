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
import {
  DomInputRouter,
  type InputDebugState,
  type RoutedSurfaceHit,
} from './input/dom-input-router';

const PARKED_TRANSFORM = 'translate(-100000px, 0)';

function captureElementStyle(element: HTMLElement): ElementStyleSnapshot {
  return {
    htmlSurfaceId: element.getAttribute('data-html-surface-id'),
    inert: element.inert,
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
  element.inert = snapshot.inert;
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
  focusTarget?: string;
  capturedPointerId?: number;
};

export type HtmlSurfaceManagerOptions = {
  renderer: WebGLRenderer;
  camera: Camera;
  scene: Scene;
  raycastRoots?: readonly Object3D[];
  backend?: BackendPreference | HtmlTextureBackend;
  onDebugChange?: (state: HtmlSurfaceDebugState) => void;
};

type ElementStyleSnapshot = {
  htmlSurfaceId: string | null;
  inert: boolean;
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
  disposed: boolean;
  invalidate(): void;
  api: HtmlSurface;
};

export class HtmlSurfaceManager {
  readonly backendKind: BackendKind;

  private readonly renderer: WebGLRenderer;
  private readonly camera: Camera;
  private readonly scene: Scene;
  private readonly raycastRoots?: readonly Object3D[];
  private readonly backend: HtmlTextureBackend;
  private readonly capabilities: CapabilityReport;
  private readonly inputRouter: DomInputRouter;
  private readonly onDebugChange?: (state: HtmlSurfaceDebugState) => void;
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly bindingClaims = new MaterialBindingClaims();
  private readonly registry = new SurfaceRegistry<SurfaceRecord>();

  private idSequence = 0;
  private disposed = false;
  private debugState: HtmlSurfaceDebugState = { kind: 'none' };
  private inputDebugState: InputDebugState = {};

  constructor(options: HtmlSurfaceManagerOptions) {
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.scene = options.scene;
    this.raycastRoots = options.raycastRoots;
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

    this.inputRouter = new DomInputRouter({
      canvas: options.renderer.domElement,
      routePoint: (clientX, clientY) => (
        this.routePointer(clientX, clientY)
      ),
      onDebugChange: (state) => {
        this.inputDebugState = state;
        this.onDebugChange?.(this.getDebugState());
      },
    });
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
        record.invalidate();
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
        this.inputRouter.syncSurface(record);
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
      disposed: false,
      invalidate() {
        if (!record.disposed) {
          textureHandle.invalidate();
        }
      },
      api,
    } satisfies SurfaceRecord);

    this.registry.add(record);
    this.inputRouter.registerSurface(record);
    textureHandle.invalidate();

    return api;
  }

  update(): void {
    if (this.disposed) {
      return;
    }

    this.inputRouter.update();
  }

  getDebugState(): HtmlSurfaceDebugState {
    return {
      ...this.debugState,
      surfaceId: (
        this.debugState.surfaceId
        ?? this.inputDebugState.surfaceId
      ),
      focusTarget: this.inputDebugState.focusTarget,
      capturedPointerId: this.inputDebugState.capturedPointerId,
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
    this.inputRouter.dispose();
    for (const surface of this.registry.values()) {
      this.removeRecord(surface);
    }
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

  private routePointer(
    clientX: number,
    clientY: number,
  ): RoutedSurfaceHit | undefined {
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
      .intersectObjects(
        (this.raycastRoots ?? this.scene.children) as Object3D[],
        true,
      )
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

    return {
      surface,
      domPoint,
    };
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

  private publishDebug(state: HtmlSurfaceDebugState): void {
    this.debugState = state;
    this.onDebugChange?.(this.getDebugState());
  }

  private removeRecord(surface: SurfaceRecord): void {
    if (surface.disposed) {
      return;
    }

    surface.disposed = true;
    this.inputRouter.unregisterSurface(surface);
    this.registry.remove(surface);

    surface.binding.restore();
    surface.textureHandle.dispose();
    surface.binding.disposeOwnedResources();
    restoreElementStyle(surface.element, surface.elementSnapshot);
  }
}
