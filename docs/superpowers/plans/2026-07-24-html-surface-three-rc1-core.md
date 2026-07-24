# HTML Surface Three RC1 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `0.1.0-rc.1`の安定Facade、Material／UV Binding、複数Surface Registry、型付きエラー、Backend境界、CapabilityReport、所有権規則を実装する。

**Architecture:** `HtmlSurfaceManager`を利用者向けFacadeとして残し、Material Binding、Surface Registry、Capability生成を純粋または小さい状態オブジェクトへ分ける。`three-html-render`とThree.js `HTMLTexture`への依存はBackend内へ閉じ、ManagerはTexture handleだけを扱う。

**Tech Stack:** TypeScript 7、Three.js 0.185、Vitest 4、Vite 8、three-html-render 0.1.2

## Global Constraints

- HTML SurfaceはHTMLElement、Mesh、Texture生成、Material適用、UV／DOM座標、入力、遮蔽、ライフサイクルを一単位で管理する。
- Vanilla APIを中核とし、Reactへ依存しない。
- stableブラウザではpolyfill Backendを既定にし、native Backendは明示選択した実験経路とする。
- Three.js r185で検証するが、r185固有の実験APIをFacadeへ露出しない。
- HTMLElement、Mesh、Material、Geometryは既定で利用者所有とする。
- 公開API名はRC1実装中に簡略化できるが、設計書の能力と所有権を削らない。
- README、コミットメッセージ、PR文は日本語で記述する。
- 新規テストは、共有ロジックと回帰リスクが高い仕様を固定するために追加する。

---

## File Structure

- Create: `src/core/errors.ts` — 型付きエラーと安定エラーコード
- Create: `src/core/capabilities.ts` — CapabilityReportの型と生成
- Create: `src/core/material-binding.ts` — Materialプロパティのclaim、適用、復元、所有権
- Create: `src/core/surface-registry.ts` — ID、Mesh、MaterialスロットからSurfaceを解決
- Modify: `src/core/hit-test.ts` — Materialスロットを含むhit候補
- Modify: `src/backends/html-texture-backend.ts` — Backend preference、ready、stable優先選択
- Modify: `src/HtmlSurfaceManager.ts` — 安定Facadeとして上記責務を統合
- Modify: `src/index.ts` — 安定APIだけをexport
- Create: `src/experimental.ts` — Backend SPIとnative明示指定のexport
- Test: `tests/errors.test.ts`
- Test: `tests/capabilities.test.ts`
- Test: `tests/material-binding.test.ts`
- Test: `tests/surface-registry.test.ts`
- Test: `tests/backend-selection.test.ts`
- Test: `tests/manager-lifecycle.test.ts`

### Task 1: 型付きエラーとCapabilityReport

**Files:**
- Create: `src/core/errors.ts`
- Create: `src/core/capabilities.ts`
- Create: `tests/errors.test.ts`
- Create: `tests/capabilities.test.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `HtmlSurfaceError`, `HtmlSurfaceErrorCode`, `CapabilityReport`, `CapabilityWarning`, `createCapabilityReport()`
- Consumes: `BackendPreference`と`BackendKind`。Task 4までは同名のlocal unionで先に定義し、Task 4でBackend moduleからimportする。

- [ ] **Step 1: 型付きエラーの失敗テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { HtmlSurfaceError } from '../src/core/errors';

describe('HtmlSurfaceError', () => {
  it('安定したcodeとcauseを保持する', () => {
    const cause = new Error('upload failed');
    const error = new HtmlSurfaceError(
      'backend-initialization-failed',
      'Backendを初期化できませんでした。',
      { cause },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HtmlSurfaceError');
    expect(error.code).toBe('backend-initialization-failed');
    expect(error.cause).toBe(cause);
  });
});
```

- [ ] **Step 2: エラーテストが失敗することを確認する**

Run: `npx vitest run tests/errors.test.ts`

Expected: FAIL with `Cannot find module '../src/core/errors'`.

- [ ] **Step 3: エラー型を実装する**

```ts
export type HtmlSurfaceErrorCode =
  | 'manager-disposed'
  | 'duplicate-surface-id'
  | 'material-not-found'
  | 'material-index-out-of-range'
  | 'material-binding-conflict'
  | 'invalid-map-property'
  | 'backend-unavailable'
  | 'backend-initialization-failed'
  | 'surface-disposed';

export class HtmlSurfaceError extends Error {
  readonly code: HtmlSurfaceErrorCode;

  constructor(
    code: HtmlSurfaceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HtmlSurfaceError';
    this.code = code;
  }
}
```

- [ ] **Step 4: CapabilityReportの失敗テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { createCapabilityReport } from '../src/core/capabilities';

describe('createCapabilityReport', () => {
  it('要求Backendと実際のBackend、入力能力、警告を分けて返す', () => {
    const report = createCapabilityReport({
      requested: 'native',
      active: 'polyfill',
      nativeAvailable: false,
      pointerEvents: true,
      pointerCapture: true,
      touch: true,
      webgl: true,
    });

    expect(report.backend).toEqual({
      requested: 'native',
      active: 'polyfill',
      nativeAvailable: false,
    });
    expect(report.input.keyboard).toBe(true);
    expect(report.input.ime).toBe(true);
    expect(report.rendering.requiresUv).toBe(true);
    expect(report.warnings.map((warning) => warning.code)).toContain(
      'native-backend-unavailable',
    );
  });
});
```

- [ ] **Step 5: CapabilityReportを実装する**

```ts
export type BackendPreference = 'auto' | 'polyfill' | 'native';
export type ActiveBackendKind = 'polyfill' | 'native';

export type CapabilityWarningCode =
  | 'native-backend-unavailable'
  | 'native-backend-experimental'
  | 'pointer-capture-unavailable'
  | 'touch-unavailable';

export type CapabilityWarning = {
  code: CapabilityWarningCode;
  message: string;
};

export type CapabilityReport = {
  backend: {
    requested: BackendPreference;
    active: ActiveBackendKind;
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

export function createCapabilityReport(
  input: {
    requested: BackendPreference;
    active: ActiveBackendKind;
    nativeAvailable: boolean;
    pointerEvents: boolean;
    pointerCapture: boolean;
    touch: boolean;
    webgl: boolean;
  },
): CapabilityReport {
  const warnings: CapabilityWarning[] = [];
  if (input.requested === 'native' && !input.nativeAvailable) {
    warnings.push({
      code: 'native-backend-unavailable',
      message: 'native HTML-in-Canvasを利用できないためpolyfillを使用します。',
    });
  }
  if (input.active === 'native') {
    warnings.push({
      code: 'native-backend-experimental',
      message: 'native HTML-in-Canvas Backendは実験機能です。',
    });
  }
  if (!input.pointerCapture) {
    warnings.push({
      code: 'pointer-capture-unavailable',
      message: 'Pointer Captureを利用できません。',
    });
  }
  if (!input.touch) {
    warnings.push({
      code: 'touch-unavailable',
      message: 'Touch PointerEventを検出できません。',
    });
  }

  return {
    backend: {
      requested: input.requested,
      active: input.active,
      nativeAvailable: input.nativeAvailable,
    },
    input: {
      pointerEvents: input.pointerEvents,
      pointerCapture: input.pointerCapture,
      wheel: true,
      touch: input.touch,
      keyboard: true,
      ime: true,
    },
    rendering: {
      webgl: input.webgl,
      requiresUv: true,
    },
    warnings,
  };
}
```

- [ ] **Step 6: テストと型検査を通す**

Run: `npx vitest run tests/errors.test.ts tests/capabilities.test.ts && npm run typecheck`

Expected: 2 files PASS、typecheck exit 0.

- [ ] **Step 7: 安定型をroot exportしてコミットする**

```ts
export {
  HtmlSurfaceError,
  type HtmlSurfaceErrorCode,
} from './core/errors';
export {
  type CapabilityReport,
  type CapabilityWarning,
  type CapabilityWarningCode,
} from './core/capabilities';
```

Run:

```bash
git add src/core/errors.ts src/core/capabilities.ts src/index.ts tests/errors.test.ts tests/capabilities.test.ts
git commit -m "feat: 型付きエラーとCapability診断を追加"
```

### Task 2: Material Bindingと所有権

**Files:**
- Create: `src/core/material-binding.ts`
- Create: `tests/material-binding.test.ts`

**Interfaces:**
- Consumes: `HtmlSurfaceError`
- Produces: `MaterialBindingOptions`, `MaterialBinding`, `MaterialBindingClaims`, `bindSurfaceTexture()`

- [ ] **Step 1: 適用、競合、外部変更、復元の失敗テストを書く**

```ts
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Texture,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  MaterialBindingClaims,
  bindSurfaceTexture,
} from '../src/core/material-binding';
import { HtmlSurfaceError } from '../src/core/errors';

describe('bindSurfaceTexture', () => {
  it('Textureを適用し、自分のTextureが残っている場合だけ元へ戻す', () => {
    const previous = new Texture();
    const texture = new Texture();
    const material = new MeshBasicMaterial({ map: previous });
    const mesh = new Mesh(new BoxGeometry(), material);
    const claims = new MaterialBindingClaims();

    const binding = bindSurfaceTexture({
      mesh,
      materialIndex: 0,
      mapProperty: 'map',
      texture,
      disposeMaterial: false,
      disposeGeometry: false,
    }, claims);

    expect(material.map).toBe(texture);
    expect(binding.restore()).toEqual({ restored: true });
    expect(material.map).toBe(previous);
  });

  it('利用者が後から変更したMaterial値を上書きしない', () => {
    const texture = new Texture();
    const external = new Texture();
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(new BoxGeometry(), material);
    const binding = bindSurfaceTexture({
      mesh,
      mapProperty: 'map',
      texture,
    }, new MaterialBindingClaims());

    material.map = external;
    expect(binding.restore()).toEqual({ restored: false });
    expect(material.map).toBe(external);
  });

  it('同じMaterial propertyへの二重Bindingを拒否する', () => {
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(new BoxGeometry(), material);
    const claims = new MaterialBindingClaims();
    bindSurfaceTexture({ mesh, mapProperty: 'map', texture: new Texture() }, claims);

    expect(() => bindSurfaceTexture({
      mesh,
      mapProperty: 'map',
      texture: new Texture(),
    }, claims)).toThrowError(HtmlSurfaceError);
  });

  it('明示所有したMaterialとGeometryだけを破棄する', () => {
    const material = new MeshBasicMaterial();
    const geometry = new BoxGeometry();
    const mesh = new Mesh(geometry, material);
    const materialDispose = vi.spyOn(material, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const binding = bindSurfaceTexture({
      mesh,
      mapProperty: 'map',
      texture: new Texture(),
      disposeMaterial: true,
      disposeGeometry: true,
    }, new MaterialBindingClaims());

    binding.disposeOwnedResources();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: テストがmodule未実装で失敗することを確認する**

Run: `npx vitest run tests/material-binding.test.ts`

Expected: FAIL with `Cannot find module '../src/core/material-binding'`.

- [ ] **Step 3: Material解決とclaim管理を実装する**

```ts
import {
  Material,
  type Mesh,
  type Texture,
} from 'three';
import { HtmlSurfaceError } from './errors';

type MaterialRecord = Material & Record<string, unknown>;

export type MaterialBindingOptions = {
  mesh: Mesh;
  material?: Material;
  materialIndex?: number;
  mapProperty?: string;
  texture: Texture;
  disposeMaterial?: boolean;
  disposeGeometry?: boolean;
};

export class MaterialBindingClaims {
  private readonly values = new WeakMap<Material, Set<string>>();

  claim(material: Material, property: string): void {
    const properties = this.values.get(material) ?? new Set<string>();
    if (properties.has(property)) {
      throw new HtmlSurfaceError(
        'material-binding-conflict',
        `Materialの${property}は既に別のHTML SurfaceへBindingされています。`,
      );
    }
    properties.add(property);
    this.values.set(material, properties);
  }

  release(material: Material, property: string): void {
    this.values.get(material)?.delete(property);
  }
}

function resolveMaterial(options: MaterialBindingOptions): Material {
  if (options.material) return options.material;
  const source = options.mesh.material;
  if (!source) {
    throw new HtmlSurfaceError(
      'material-not-found',
      'HTML Surfaceの対象Materialがありません。',
    );
  }
  if (!Array.isArray(source)) return source;
  const index = options.materialIndex ?? 0;
  const material = source[index];
  if (!material) {
    throw new HtmlSurfaceError(
      'material-index-out-of-range',
      `materialIndex ${index}は存在しません。`,
    );
  }
  return material;
}
```

- [ ] **Step 4: Binding handleを実装する**

```ts
export type MaterialBinding = {
  readonly material: Material;
  readonly materialIndex: number;
  readonly mapProperty: string;
  restore(): { restored: boolean };
  disposeOwnedResources(): void;
};

export function bindSurfaceTexture(
  options: MaterialBindingOptions,
  claims: MaterialBindingClaims,
): MaterialBinding {
  const material = resolveMaterial(options) as MaterialRecord;
  const materialIndex = options.materialIndex ?? 0;
  const mapProperty = options.mapProperty ?? 'map';
  if (!(mapProperty in material)) {
    throw new HtmlSurfaceError(
      'invalid-map-property',
      `Materialに${mapProperty}プロパティがありません。`,
    );
  }
  claims.claim(material, mapProperty);
  const previous = material[mapProperty];
  material[mapProperty] = options.texture;
  material.needsUpdate = true;
  let released = false;

  const release = () => {
    if (released) return;
    released = true;
    claims.release(material, mapProperty);
  };

  return {
    material,
    materialIndex,
    mapProperty,
    restore() {
      const restored = material[mapProperty] === options.texture;
      if (restored) {
        material[mapProperty] = previous;
        material.needsUpdate = true;
      }
      release();
      return { restored };
    },
    disposeOwnedResources() {
      if (options.disposeMaterial) material.dispose();
      if (options.disposeGeometry) options.mesh.geometry.dispose();
    },
  };
}
```

- [ ] **Step 5: 対象テストと既存テストを通す**

Run: `npx vitest run tests/material-binding.test.ts tests/hit-test.test.ts && npm run typecheck`

Expected: 2 files PASS、typecheck exit 0.

- [ ] **Step 6: コミットする**

```bash
git add src/core/material-binding.ts tests/material-binding.test.ts
git commit -m "feat: Material Bindingと所有権を分離"
```

### Task 3: Materialスロット対応Surface Registry

**Files:**
- Create: `src/core/surface-registry.ts`
- Create: `tests/surface-registry.test.ts`
- Modify: `src/core/hit-test.ts`
- Modify: `tests/hit-test.test.ts`

**Interfaces:**
- Produces: `SurfaceRegistration`, `SurfaceRegistry`, `HitCandidate.materialIndex`
- Consumes: `HtmlSurfaceError`

- [ ] **Step 1: Registryの失敗テストを書く**

```ts
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { SurfaceRegistry } from '../src/core/surface-registry';
import { HtmlSurfaceError } from '../src/core/errors';

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
    const first: Surface = { id: 'first', mesh, materialIndex: 0, enabled: true };
    const second: Surface = { id: 'second', mesh, materialIndex: 1, enabled: true };
    const registry = new SurfaceRegistry<Surface>();
    registry.add(first);
    registry.add(second);

    expect(registry.resolve(child, 1)).toBe(second);
  });

  it('無効Surfaceを返さない', () => {
    const mesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
    const surface: Surface = { id: 'disabled', mesh, materialIndex: 0, enabled: false };
    const registry = new SurfaceRegistry<Surface>();
    registry.add(surface);
    expect(registry.resolve(mesh, 0)).toBeUndefined();
  });

  it('ID重複を拒否し、remove後は再登録できる', () => {
    const mesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
    const registry = new SurfaceRegistry<Surface>();
    const surface: Surface = { id: 'panel', mesh, materialIndex: 0, enabled: true };
    registry.add(surface);
    expect(() => registry.add({ ...surface })).toThrowError(HtmlSurfaceError);
    registry.remove(surface);
    expect(() => registry.add({ ...surface })).not.toThrow();
  });
});
```

- [ ] **Step 2: Registryテストが失敗することを確認する**

Run: `npx vitest run tests/surface-registry.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Registryを実装する**

```ts
import type { Mesh, Object3D } from 'three';
import { HtmlSurfaceError } from './errors';

export type SurfaceRegistration = {
  readonly id: string;
  readonly mesh: Mesh;
  readonly materialIndex: number;
  readonly enabled: boolean;
};

export class SurfaceRegistry<
  Surface extends SurfaceRegistration,
> {
  private readonly ids = new Map<string, Surface>();
  private readonly meshes = new Map<Object3D, Set<Surface>>();

  add(surface: Surface): void {
    if (this.ids.has(surface.id)) {
      throw new HtmlSurfaceError(
        'duplicate-surface-id',
        `HTML Surface ID "${surface.id}"は既に使用されています。`,
      );
    }
    this.ids.set(surface.id, surface);
    const values = this.meshes.get(surface.mesh) ?? new Set<Surface>();
    values.add(surface);
    this.meshes.set(surface.mesh, values);
  }

  remove(surface: Surface): void {
    this.ids.delete(surface.id);
    const values = this.meshes.get(surface.mesh);
    values?.delete(surface);
    if (values?.size === 0) this.meshes.delete(surface.mesh);
  }

  resolve(object: Object3D, materialIndex = 0): Surface | undefined {
    let current: Object3D | null = object;
    while (current) {
      const surface = [...(this.meshes.get(current) ?? [])].find(
        (item) => item.enabled && item.materialIndex === materialIndex,
      );
      if (surface) return surface;
      current = current.parent;
    }
    return undefined;
  }

  values(): readonly Surface[] {
    return [...this.ids.values()];
  }
}
```

- [ ] **Step 4: hit candidateへMaterialスロットを追加する**

```ts
export type HitCandidate<ObjectType> = {
  distance: number;
  object: ObjectType;
  materialIndex?: number;
  uv?: UvPoint;
};

export function resolveFrontmostHit<ObjectType, SurfaceType>(
  hits: readonly HitCandidate<ObjectType>[],
  resolveSurface: (
    object: ObjectType,
    materialIndex: number | undefined,
  ) => SurfaceType | undefined,
  shouldIgnore: (object: ObjectType) => boolean,
): FrontmostHit<ObjectType, SurfaceType> {
  const sortedHits = [...hits].sort((a, b) => a.distance - b.distance);

  for (const hit of sortedHits) {
    if (shouldIgnore(hit.object)) {
      continue;
    }

    const surface = resolveSurface(hit.object, hit.materialIndex);
    if (surface && hit.uv) {
      return {
        kind: 'surface',
        hit,
        surface,
        uv: hit.uv,
      };
    }

    return {
      kind: 'blocked',
      hit,
    };
  }

  return { kind: 'none' };
}
```

`tests/hit-test.test.ts`の`resolveSurface`を2引数に変更し、次を追加する。

```ts
it('交差面のMaterialスロットをSurface解決へ渡す', () => {
  const slots: Array<number | undefined> = [];
  resolveFrontmostHit(
    [{ distance: 1, object: panel, materialIndex: 2, uv: { x: 0.5, y: 0.5 } }],
    (object, materialIndex) => {
      slots.push(materialIndex);
      return object === panel ? surface : undefined;
    },
    shouldIgnore,
  );
  expect(slots).toEqual([2]);
});
```

- [ ] **Step 5: Texture transformを含むUV回帰テストを追加する**

`tests/coordinates.test.ts`へ次を追加する。

```ts
import {
  RepeatWrapping,
  Texture,
  Vector2,
} from 'three';

it('repeat、offset、rotation、flipYをTexture transformから反映する', () => {
  const texture = new Texture();
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1.5, 0.75);
  texture.offset.set(0.1, 0.2);
  texture.rotation = Math.PI / 8;
  texture.center.set(0.5, 0.5);
  texture.flipY = true;
  texture.updateMatrix();

  const expected = new Vector2(0.3, 0.65);
  texture.transformUv(expected);
  const actual = copyAndTransformUv({ x: 0.3, y: 0.65 }, (uv) => {
    const vector = new Vector2(uv.x, uv.y);
    texture.transformUv(vector);
    uv.x = vector.x;
    uv.y = vector.y;
  });

  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
});
```

- [ ] **Step 6: Registry、hit test、UV testを通す**

Run: `npx vitest run tests/surface-registry.test.ts tests/hit-test.test.ts tests/coordinates.test.ts && npm run typecheck`

Expected: 3 files PASS、typecheck exit 0.

- [ ] **Step 7: コミットする**

```bash
git add src/core/surface-registry.ts src/core/hit-test.ts tests/surface-registry.test.ts tests/hit-test.test.ts tests/coordinates.test.ts
git commit -m "feat: Materialスロット対応Surface Registryを追加"
```

### Task 4: stable優先Backend契約

**Files:**
- Modify: `src/backends/html-texture-backend.ts`
- Create: `tests/backend-selection.test.ts`
- Create: `src/experimental.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `BackendPreference`, `BackendKind`, `HtmlTextureBackend`, `HtmlTextureHandle.ready`, `detectNativeHtmlInCanvas()`, `createHtmlTextureBackend()`
- Consumes: `HtmlSurfaceError`

- [ ] **Step 1: Backend選択の失敗テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { selectBackendKind } from '../src/backends/html-texture-backend';
import { HtmlSurfaceError } from '../src/core/errors';

describe('selectBackendKind', () => {
  it('autoはnative利用可能でもstable優先でpolyfillを返す', () => {
    expect(selectBackendKind('auto', true)).toBe('polyfill');
  });

  it('明示nativeかつ利用可能ならnativeを返す', () => {
    expect(selectBackendKind('native', true)).toBe('native');
  });

  it('明示nativeが利用不能なら型付きエラーにする', () => {
    expect(() => selectBackendKind('native', false)).toThrowError(
      HtmlSurfaceError,
    );
  });
});
```

- [ ] **Step 2: 選択テストが失敗することを確認する**

Run: `npx vitest run tests/backend-selection.test.ts`

Expected: FAIL because `selectBackendKind` is not exported.

- [ ] **Step 3: Backend選択とready契約を実装する**

```ts
import {
  HTMLTexture,
  LinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { installHtmlInCanvasPolyfill } from 'three-html-render/polyfill';
import { HtmlSurfaceError } from '../core/errors';
import { adaptLegacyHtmlTextureUpload } from './polyfill-compat';

export type BackendPreference = 'auto' | BackendKind;
export type BackendKind = 'native' | 'polyfill';

export type HtmlTextureHandle = {
  readonly texture: Texture;
  readonly ready: Promise<void>;
  invalidate(): void;
  dispose(): void;
};

export type HtmlTextureBackend = {
  readonly kind: BackendKind;
  readonly nativeAvailable: boolean;
  mount(element: HTMLElement): HtmlTextureHandle;
  requestPaint(): void;
};

type HtmlCanvasElement = HTMLCanvasElement & {
  requestPaint?: () => void;
};

export function detectNativeHtmlInCanvas(
  sourceCanvas: HTMLCanvasElement,
): boolean {
  const canvas = sourceCanvas as HtmlCanvasElement;
  if (typeof canvas.requestPaint !== 'function') return false;
  return [
    globalThis.WebGLRenderingContext,
    globalThis.WebGL2RenderingContext,
  ].some((contextType) => (
    contextType !== undefined
    && 'texElementImage2D' in contextType.prototype
  ));
}

export function selectBackendKind(
  requested: BackendPreference,
  nativeAvailable: boolean,
): BackendKind {
  if (requested === 'auto' || requested === 'polyfill') return 'polyfill';
  if (nativeAvailable) return 'native';
  throw new HtmlSurfaceError(
    'backend-unavailable',
    'native HTML-in-Canvas Backendを利用できません。',
  );
}
```

`createHtmlTextureBackend`を次の完全な処理へ変更する。

```ts
export function createHtmlTextureBackend(options: {
  sourceCanvas: HTMLCanvasElement;
  preference?: BackendPreference;
}): HtmlTextureBackend {
  const canvas = options.sourceCanvas as HtmlCanvasElement;
  const nativeAvailable = detectNativeHtmlInCanvas(canvas);
  const kind = selectBackendKind(options.preference ?? 'auto', nativeAvailable);
  canvas.setAttribute('layoutsubtree', '');

  if (kind === 'polyfill') {
    installHtmlInCanvasPolyfill();
    for (const contextType of [
      globalThis.WebGLRenderingContext,
      globalThis.WebGL2RenderingContext,
    ]) {
      const prototype = contextType?.prototype as
        | (object & {
          texElementImage2D?: (...args: any[]) => unknown;
        })
        | undefined;
      if (typeof prototype?.texElementImage2D === 'function') {
        adaptLegacyHtmlTextureUpload(
          prototype as Parameters<typeof adaptLegacyHtmlTextureUpload>[0],
        );
      }
    }
  }

  const requestPaint = () => canvas.requestPaint?.();

  return {
    kind,
    nativeAvailable,
    requestPaint,
    mount(element) {
      const texture = new HTMLTexture(element);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      let disposed = false;
      const invalidate = () => {
        if (disposed) return;
        texture.needsUpdate = true;
        requestPaint();
      };
      const observer = new MutationObserver(invalidate);
      observer.observe(element, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });
      const invalidateEvents = [
        'input',
        'change',
        'scroll',
        'compositionend',
      ] as const;
      for (const eventName of invalidateEvents) {
        element.addEventListener(eventName, invalidate, true);
      }
      invalidate();

      return {
        texture,
        ready: Promise.resolve(),
        invalidate,
        dispose() {
          if (disposed) return;
          disposed = true;
          observer.disconnect();
          for (const eventName of invalidateEvents) {
            element.removeEventListener(eventName, invalidate, true);
          }
          texture.dispose();
          element.remove();
        },
      };
    },
  };
}
```

- [ ] **Step 4: experimental entryを追加しroot exportを整理する**

`src/experimental.ts`:

```ts
export {
  createHtmlTextureBackend,
  detectNativeHtmlInCanvas,
  selectBackendKind,
  type HtmlTextureBackend,
  type HtmlTextureHandle,
} from './backends/html-texture-backend';
```

`src/index.ts`では次だけをBackend関連の安定型としてexportする。

```ts
export type {
  BackendKind,
  BackendPreference,
} from './backends/html-texture-backend';
```

- [ ] **Step 5: CapabilityのBackend型を一元化する**

`src/core/capabilities.ts`からlocalの`BackendPreference`と`ActiveBackendKind`を削除し、次をimportする。

```ts
import type {
  BackendKind,
  BackendPreference,
} from '../backends/html-texture-backend';
```

`CapabilityReport.backend.active`と`createCapabilityReport()`の`active`引数は`BackendKind`を使う。

- [ ] **Step 6: Backendと互換adapterのテストを通す**

Run: `npx vitest run tests/backend-selection.test.ts tests/polyfill-compat.test.ts && npm run typecheck`

Expected: 2 files PASS、typecheck exit 0.

- [ ] **Step 7: コミットする**

```bash
git add src/backends/html-texture-backend.ts src/experimental.ts src/index.ts tests/backend-selection.test.ts
git commit -m "feat: stable優先のBackend境界を定義"
```

### Task 5: Manager Facadeとライフサイクル統合

**Files:**
- Modify: `src/HtmlSurfaceManager.ts`
- Modify: `src/index.ts`
- Create: `tests/manager-lifecycle.test.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `MaterialBindingClaims`, `bindSurfaceTexture()`, `SurfaceRegistry`, `createCapabilityReport()`, `createHtmlTextureBackend()`
- Produces: RC1 `HtmlSurfaceManager`, `HtmlSurface`, `HtmlSurfaceOptions`, `HtmlSurfaceManagerOptions`

- [ ] **Step 1: DOM統合テスト用にhappy-domを追加する**

Run: `npm install --save-dev happy-dom`

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/manager-*.test.ts', 'happy-dom'],
    ],
  },
});
```

- [ ] **Step 2: Manager lifecycleの失敗テストを書く**

```ts
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
import { HtmlSurfaceError } from '../src/core/errors';

function createHarness() {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({
      left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, x: 0, y: 0,
      toJSON() {},
    }),
  });
  const dispose = vi.fn();
  const handle: HtmlTextureHandle = {
    texture: new Texture(),
    ready: Promise.resolve(),
    invalidate: vi.fn(),
    dispose,
  };
  const backend: HtmlTextureBackend = {
    kind: 'polyfill',
    nativeAvailable: false,
    mount: vi.fn(() => handle),
    requestPaint: vi.fn(),
  };
  const manager = new HtmlSurfaceManager({
    renderer: { domElement: canvas } as never,
    camera: new PerspectiveCamera(),
    scene: new Scene(),
    backend,
  });
  return { manager, handle, dispose };
}

describe('HtmlSurfaceManager lifecycle', () => {
  it('Surfaceを無効化・再有効化し、破棄は冪等に行う', () => {
    const { manager, dispose } = createHarness();
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(new PlaneGeometry(), material);
    const element = document.createElement('div');
    document.body.append(element);
    const surface = manager.add({ id: 'panel', element, mesh });

    surface.setEnabled(false);
    expect(surface.enabled).toBe(false);
    surface.setEnabled(true);
    expect(surface.enabled).toBe(true);
    surface.dispose();
    surface.dispose();

    expect(dispose).toHaveBeenCalledOnce();
    expect(material.map).toBeNull();
  });

  it('Manager破棄後のaddを型付きエラーにする', () => {
    const { manager } = createHarness();
    manager.dispose();
    expect(() => manager.add({
      element: document.createElement('div'),
      mesh: new Mesh(new PlaneGeometry(), new MeshBasicMaterial()),
    })).toThrowError(HtmlSurfaceError);
  });

  it('CapabilityReportを防御的コピーで返す', () => {
    const { manager } = createHarness();
    const first = manager.getCapabilityReport();
    expect(first.backend.active).toBe('polyfill');
    expect(Object.isFrozen(first.warnings)).toBe(true);
  });
});
```

- [ ] **Step 3: テストがFacade未対応で失敗することを確認する**

Run: `npx vitest run tests/manager-lifecycle.test.ts`

Expected: FAIL because `setEnabled` and `getCapabilityReport` do not exist.

- [ ] **Step 4: Managerのrecordと公開handleをRC1形へ変更する**

`HtmlSurfaceManagerOptions`は文字列Backendを安定設定、Backend objectを`./experimental`から型をimportする上級用途とテスト用途として受け取る。

```ts
export type HtmlSurfaceManagerOptions = {
  renderer: WebGLRenderer;
  camera: Camera;
  scene: Scene;
  backend?: BackendPreference | HtmlTextureBackend;
  onDebugChange?: (state: HtmlSurfaceDebugState) => void;
};
```

Constructorでは次の分岐を使う。

```ts
const backendOption = options.backend ?? 'auto';
const requestedBackend: BackendPreference = typeof backendOption === 'string'
  ? backendOption
  : backendOption.kind;
this.backend = typeof backendOption === 'string'
  ? createHtmlTextureBackend({
    sourceCanvas: options.renderer.domElement,
    preference: backendOption,
  })
  : backendOption;
```

`SurfaceRecord`へ次を持たせる。

```ts
type SurfaceRecord = SurfaceRegistration & {
  element: HTMLElement;
  mesh: Mesh;
  enabled: boolean;
  binding: MaterialBinding;
  textureHandle: HtmlTextureHandle;
  transformUv?: HtmlSurfaceOptions['transformUv'];
  eventCleanup: Array<() => void>;
  disposed: boolean;
  api: HtmlSurface;
};
```

`HtmlSurface`を次へ変更する。

```ts
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
```

Manager内部では次を行う。

- `MaterialBindingClaims`を1つ所有する
- `SurfaceRegistry<SurfaceRecord>`を所有する
- `add()`でBackend handleを生成してからBindingし、失敗時はhandleを破棄する
- `removeRecord()`でRegistry、events、Binding、Texture、owned resourceの順に解放する
- `setEnabled(false)`でactive DOMをparkし、Registry解決対象から外す
- Manager破棄後の`add()`は`manager-disposed`
- Surface破棄後の`setEnabled()`は`surface-disposed`
- `invalidate()`と`dispose()`は破棄後も安全なno-op

- [ ] **Step 5: Materialスロット付きRaycastへRegistryを接続する**

交差変換へ次を追加する。

```ts
materialIndex: hit.face?.materialIndex,
```

Surface解決を次へ置き換える。

```ts
const result = resolveFrontmostHit(
  intersections,
  (object, materialIndex) => (
    this.registry.resolve(object, materialIndex ?? 0)
  ),
  (object) => this.shouldIgnoreObject(object),
);
```

- [ ] **Step 6: CapabilityReportをManagerへ接続する**

ConstructorでBackend preference、native availability、環境能力からreportを一度生成し、`getCapabilityReport()`ではwarnings配列をfreezeした防御的コピーを返す。

```ts
getCapabilityReport(): CapabilityReport {
  return {
    ...this.capabilities,
    backend: { ...this.capabilities.backend },
    input: { ...this.capabilities.input },
    rendering: { ...this.capabilities.rendering },
    warnings: Object.freeze([...this.capabilities.warnings]),
  };
}
```

- [ ] **Step 7: Managerと全unit testを通す**

Run: `npm test && npm run typecheck && npm run build:lib`

Expected: all tests PASS、typecheck exit 0、`dist/html-surface-three.js`生成。

- [ ] **Step 8: コミットする**

```bash
git add package.json package-lock.json vitest.config.ts src/HtmlSurfaceManager.ts src/index.ts tests/manager-lifecycle.test.ts
git commit -m "feat: RC1のSurface Facadeとライフサイクルを実装"
```

## Plan 1 Completion Gate

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build:lib`
- [ ] Managerファイルが入力イベントを除き、Binding／Registry／Capabilityの詳細を直接実装していない
- [ ] root exportにnative実験APIまたは`three-html-render`固有型が混入していない
- [ ] `git status --short`がclean
