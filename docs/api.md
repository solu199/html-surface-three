# APIリファレンス

この文書は`html-surface-three@0.1.0-rc.1`の安定エントリーポイントを説明します。描画Backendの差し替えAPIは[`html-surface-three/experimental`](backends.md)に分離されています。

## `HtmlSurfaceManager`

HTML Surfaceの登録、scene全体を使った遮蔽判定、入力ルーティング、複数Surfaceのライフサイクルを管理します。

```ts
const manager = new HtmlSurfaceManager({
  renderer,
  camera,
  scene,
  backend: 'auto',
  onDebugChange(state) {
    console.debug(state);
  },
});
```

### `HtmlSurfaceManagerOptions`

| プロパティ | 型 | 既定値 | 所有権／補足 |
|---|---|---|---|
| `renderer` | `THREE.WebGLRenderer` | 必須 | 利用者所有。`domElement`から入力を受け取る |
| `camera` | `THREE.Camera` | 必須 | 利用者所有。Raycastに使用 |
| `scene` | `THREE.Scene` | 必須 | 利用者所有。遮蔽物を含め再帰Raycast |
| `backend` | `'auto' \| 'polyfill' \| 'native' \| HtmlTextureBackend` | `'auto'` | 文字列以外はexperimental契約 |
| `onDebugChange` | `(state) => void` | なし | hit、UV、focus、captureの診断通知 |

`backend: 'auto'`はstableブラウザ優先でpolyfillを選びます。native経路を暗黙には選びません。

### メソッド

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `add(options)` | `HtmlSurface` | HTMLElementとMeshを関連付ける |
| `update()` | `void` | 最後のポインター位置を再評価し、動くMesh、Camera、遮蔽物へ追従する |
| `getDebugState()` | `HtmlSurfaceDebugState` | 現在の入力診断のコピーを返す |
| `getCapabilityReport()` | `CapabilityReport` | 選択Backendと利用可能な入力能力を返す |
| `dispose()` | `void` | 全Surface、入力セッション、listenerを解放する。冪等 |

`manager.update()`はrender loopで毎フレーム呼んでください。

```ts
function frame() {
  manager.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
```

## `HtmlSurfaceOptions`

| プロパティ | 型 | 既定値 | 所有権／補足 |
|---|---|---|---|
| `id` | `string` | 自動採番 | Manager内で一意 |
| `element` | `HTMLElement` | 必須 | 利用者所有。実DOMとして保持される |
| `mesh` | `THREE.Mesh` | 必須 | 表示とRaycastの対象 |
| `material` | `THREE.Material` | `mesh.material` | 適用先を明示するときに指定 |
| `materialIndex` | `number` | `0` | 複数Materialのスロット |
| `mapProperty` | `string` | `'map'` | `emissiveMap`などTextureを保持するプロパティも指定可能 |
| `transformUv` | `(uv, texture) => void` | `texture.transformUv` | Raycast UVからDOM座標への変換 |
| `disposeMaterial` | `boolean` | `false` | `true`のときだけSurfaceがMaterialを破棄 |
| `disposeGeometry` | `boolean` | `false` | `true`のときだけSurfaceがGeometryを破棄 |
| `enabled` | `boolean` | `true` | 初期入力状態 |

同じMaterialの同じ`mapProperty`へ複数SurfaceをBindingすると`material-binding-conflict`になります。黙って上書きしません。

## `HtmlSurface`

| メンバー | 型 | 説明 |
|---|---|---|
| `id` | `string` | Surface ID |
| `element` | `HTMLElement` | 描画ソース |
| `mesh` | `THREE.Mesh` | 表示対象 |
| `texture` | `THREE.Texture` | Backendが生成したTexture |
| `enabled` | `boolean` | 現在の入力有効状態 |
| `ready` | `Promise<void>` | 初期化完了 |
| `invalidate()` | `void` | 再描画を要求。破棄後はno-op |
| `setEnabled(enabled)` | `void` | 入力を有効化／無効化。破棄後は`surface-disposed` |
| `dispose()` | `void` | Surfaceを破棄。冪等 |

破棄時は、MaterialのプロパティがまだSurfaceのTextureを参照している場合だけ元の値へ戻します。利用者が後から別Textureへ変更していた場合は上書きしません。React rootはライブラリではなく利用者が`unmount()`します。

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

desktop環境の`touch-unavailable`は、その端末でTouch PointerEventを検出できないという診断であり、初期化失敗ではありません。

## `HtmlSurfaceDebugState`

`kind`は`'none'`、`'blocked'`、`'surface'`のいずれかです。必要に応じて`objectName`、`surfaceId`、`uv`、`domPoint`、`focusTarget`、`capturedPointerId`を含みます。デモHUDや開発時の可視化を想定し、毎フレームのアプリケーション状態には使わないでください。

## `HtmlSurfaceError`

`HtmlSurfaceError`は判定可能な`code`を持ちます。

| code | 発生条件 |
|---|---|
| `manager-disposed` | 破棄済みManagerへSurfaceを追加 |
| `duplicate-surface-id` | 同じManager内でIDが重複 |
| `material-not-found` | MeshからMaterialを取得できない |
| `material-index-out-of-range` | Materialスロットが範囲外 |
| `material-binding-conflict` | 同一Materialプロパティを別Surfaceが使用中 |
| `invalid-map-property` | 適用先がTextureプロパティとして不正 |
| `backend-unavailable` | 要求したBackendを利用できない |
| `backend-initialization-failed` | HTMLElementのmountに失敗 |
| `surface-disposed` | 破棄済みSurfaceを再設定 |

## Vanilla例

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
surface.invalidate();

// cleanup
surface.dispose();
manager.dispose();
```

## React例

Reactは通常のHTMLElementを生成する利用側ライブラリです。HTML Surface ThreeのコアはReactへ依存しません。

```tsx
import { createRoot } from 'react-dom/client';

const element = document.createElement('div');
element.style.cssText = 'width: 640px; height: 420px';

const surface = manager.add({ element, mesh: monitorScreen });
const root = createRoot(element);
root.render(<ControlPanel />);
surface.invalidate();

// Reactを先に停止してからSurfaceを解放する
root.unmount();
surface.dispose();
```
