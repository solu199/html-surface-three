# API reference

This page documents the stable entry point for `html-surface-three@0.1.0`. The replaceable rendering backend API remains isolated in [`html-surface-three/experimental`](backends.md).

## `HtmlSurfaceManager`

Manages surface registration, occlusion-aware input routing, and the lifecycle of multiple surfaces.

```ts
const manager = new HtmlSurfaceManager({
  renderer,
  camera,
  scene,
  backend: 'auto',
  raycastRoots: [world, uiSurfaces],
  onDebugChange(state) {
    console.debug(state);
  },
});
```

### `HtmlSurfaceManagerOptions`

| Property | Type | Default | Ownership / notes |
|---|---|---|---|
| `renderer` | `THREE.WebGLRenderer` | required | Caller-owned; input is received from `domElement`. |
| `camera` | `THREE.Camera` | required | Caller-owned; used for raycasting. |
| `scene` | `THREE.Scene` | required | Caller-owned; supplies the default raycast roots. |
| `raycastRoots` | `readonly THREE.Object3D[]` | `scene.children` | Caller-owned array read on every route; see below. |
| `backend` | `'auto' \| 'polyfill' \| 'native' \| HtmlTextureBackend` | `'auto'` | Non-string values use the experimental contract. |
| `onDebugChange` | `(state) => void` | none | Reports hit, UV, focus, and pointer-capture diagnostics. |

`backend: 'auto'` selects the stable polyfill path and never opts into the experimental native path implicitly.

`raycastRoots` limits recursive pointer raycasts. Roots should not overlap, and every interactive surface and participating occluder must be below one of them. The manager keeps the supplied array reference, so a mutable array can be updated as the scene changes. An empty array intentionally disables pointer hits.

### Methods

| Method | Returns | Description |
|---|---|---|
| `add(options)` | `HtmlSurface` | Binds an element to a mesh. |
| `update()` | `void` | Re-evaluates the last pointer position for moving meshes, cameras, and occluders. |
| `getDebugState()` | `HtmlSurfaceDebugState` | Returns a copy of the current input diagnostics. |
| `getCapabilityReport()` | `CapabilityReport` | Returns the active backend and input capabilities. |
| `dispose()` | `void` | Idempotently releases surfaces, input sessions, and listeners. |

Call `manager.update()` once per render-loop frame.

```ts
function frame() {
  manager.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
```

## `HtmlSurfaceOptions`

| Property | Type | Default | Ownership / notes |
|---|---|---|---|
| `id` | `string` | generated | Unique within the manager. |
| `element` | `HTMLElement` | required | Caller-owned live DOM element. |
| `mesh` | `THREE.Mesh` | required | Display and raycast target. |
| `material` | `THREE.Material` | `mesh.material` | Explicit binding target. |
| `materialIndex` | `number` | `0` | Slot for multi-material meshes. |
| `mapProperty` | `string` | `'map'` | Texture property, such as `emissiveMap`. |
| `transformUv` | `(uv, texture) => void` | `texture.transformUv` | Maps raycast UVs to DOM coordinates. |
| `disposeMaterial` | `boolean` | `false` | The surface disposes the material only when `true`. |
| `disposeGeometry` | `boolean` | `false` | The surface disposes the geometry only when `true`. |
| `enabled` | `boolean` | `true` | Initial input state. |

Binding two surfaces to the same material and `mapProperty` throws `material-binding-conflict`; the existing binding is never silently overwritten.

## `HtmlSurface`

| Member | Type | Description |
|---|---|---|
| `id` | `string` | Surface ID. |
| `element` | `HTMLElement` | Rendering source. |
| `mesh` | `THREE.Mesh` | Display target. |
| `texture` | `THREE.Texture` | Backend-created texture. |
| `enabled` | `boolean` | Current input state. |
| `ready` | `Promise<void>` | Resolves after initialization. |
| `invalidate()` | `void` | Requests repaint; a no-op after disposal. |
| `setEnabled(enabled)` | `void` | Changes input state; throws `surface-disposed` after disposal. |
| `dispose()` | `void` | Idempotently disposes the surface. |

DOM mutations and `input`, `change`, `scroll`, and `compositionend` events invalidate automatically. Use `invalidate()` for paint changes that are not observable through DOM state or those events.

On disposal, the original material property is restored only if it still references the surface texture. A caller's later replacement is preserved. Materials and geometry remain caller-owned unless their dispose flag is set. The caller also owns framework roots and must unmount them before disposing the surface.

## `CapabilityReport`

```ts
type CapabilityReport = {
  backend: {
    requested: 'auto' | 'polyfill' | 'native';
    active: 'polyfill' | 'native';
    nativeAvailable: boolean;
  };
  input: {
    pointerEvents: boolean;
    pointerCapture: boolean;
    wheel: boolean;
    touch: boolean;
    keyboard: true;
    ime: true;
  };
  rendering: {
    webgl: boolean;
    requiresUv: true;
  };
  warnings: readonly CapabilityWarning[];
};
```

`touch-unavailable` on a desktop is diagnostic; it is not an initialization failure.

## `HtmlSurfaceDebugState`

`kind` is `'none'`, `'blocked'`, or `'surface'`. Depending on the state, the object may also contain `objectName`, `surfaceId`, `uv`, `domPoint`, `focusTarget`, and `capturedPointerId`. It is intended for diagnostics and demo HUDs, not application state.

## `HtmlSurfaceError`

`HtmlSurfaceError` exposes a machine-readable `code`.

| Code | Condition |
|---|---|
| `manager-disposed` | Adding a surface after manager disposal. |
| `duplicate-surface-id` | Duplicate ID within one manager. |
| `material-not-found` | No material can be resolved from the mesh. |
| `material-index-out-of-range` | Material slot is out of range. |
| `material-binding-conflict` | Another surface owns the same material property. |
| `invalid-map-property` | Binding target is not a valid texture property. |
| `backend-unavailable` | Requested backend is unavailable. |
| `backend-initialization-failed` | Mounting the element failed. |
| `surface-disposed` | Reconfiguring a disposed surface. |

## Vanilla example

```ts
import * as THREE from 'three';
import { HtmlSurfaceManager } from 'html-surface-three';

const element = document.createElement('section');
element.style.cssText = 'width: 640px; height: 420px';
element.innerHTML = `
  <button type="button">Run action</button>
  <input aria-label="Signal" />
`;

const manager = new HtmlSurfaceManager({ renderer, camera, scene });
const surface = manager.add({
  id: 'monitor',
  element,
  mesh: monitorScreen,
  materialIndex: 0,
  mapProperty: 'map',
});

await surface.ready;

// cleanup
surface.dispose();
manager.dispose();
```

## React example

React only supplies an ordinary `HTMLElement`; the core has no React dependency.

```tsx
import { createRoot } from 'react-dom/client';

const element = document.createElement('div');
element.style.cssText = 'width: 640px; height: 420px';

const surface = manager.add({ element, mesh: monitorScreen });
const root = createRoot(element);
root.render(<ControlPanel />);

// Stop React before disposing the surface.
root.unmount();
surface.dispose();
```
