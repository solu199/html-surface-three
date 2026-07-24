# HTML Surface Three Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stableブラウザでReact／VanillaのHTMLElementを任意のThree.js Meshへ関連付け、遮蔽を考慮しながら操作できるHTML Surfaceの最小プロトタイプを完成させる。

**Architecture:** HTMLの描画は交換可能な`HtmlTextureBackend`へ閉じ込め、最初の実装ではThree.js `HTMLTexture`と`three-html-render` polyfillを使用する。`HtmlSurfaceManager`はHTMLElement、Mesh、Material、UV変換、入力状態、破棄を一つのSurface recordとして管理し、シーン全体Raycastの最前面ヒットだけをDOM操作へ結び付ける。

**Tech Stack:** TypeScript 7、Three.js 0.185、three-html-render 0.1、Vite 8、React 19（デモのみ）、Vitest 4

## Global Constraints

- ライブラリの主語はHTML Surfaceとし、HTML-in-Canvasは交換可能な描画バックエンドとして扱う。
- Vanilla TypeScript APIを中核とし、コアpackageはReactへ依存しない。
- HTMLラスタライザー、UIコンポーネント集、DOMオーバーレイ、React専用ライブラリは作らない。
- 最初の縦切りでは、Texture生成、Material適用、UV／DOM変換、遮蔽込み入力、複数Surface、disposeを通す。
- Three.js r185を検証対象とするが、HTML Textureの生成処理は`HtmlTextureBackend`境界へ閉じ込める。
- 補助的なCapability APIより、操作可能な縦切りを優先する。
- README、コミットメッセージは日本語で記述する。

---

## File map

- `package.json`: 開発、テスト、library build、demo buildのコマンドとpackage公開面
- `tsconfig.json`: demoとテストを含むstrict typecheck
- `tsconfig.lib.json`: `src/index.ts`から型宣言だけを生成
- `vite.config.ts`: Reactデモ用Vite設定
- `vite.lib.config.ts`: Three.jsとthree-html-renderをexternalにするlibrary build
- `vitest.config.ts`: Node環境で共有ロジックをテスト
- `index.html`: デモのCanvas、HUD、フォールバック領域
- `src/core/coordinates.ts`: UVとDOM座標の純粋変換
- `src/core/hit-test.ts`: 最前面のSurfaceまたは遮蔽物を選ぶ純粋処理
- `src/backends/html-texture-backend.ts`: native／polyfillの選択、Texture生成、DOM host、invalidate、dispose
- `src/HtmlSurfaceManager.ts`: Surface登録、Material適用、Raycast、DOM整列、wheel、破棄
- `src/index.ts`: コア公開API
- `src/demo/ControlPanel.tsx`: React製操作パネル
- `src/demo/main.tsx`: Three.jsシーン、React／Vanilla Surface、遮蔽物、HUD
- `src/demo/styles.css`: デモとTexture化されるUIの見た目
- `tests/coordinates.test.ts`: UV変換テスト
- `tests/hit-test.test.ts`: 遮蔽を含む最前面判定テスト
- `README.md`: 調査結果、概要、制約、比較、実行方法、使用例

### Task 1: プロジェクト基盤と共有座標ロジック

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.lib.json`
- Create: `vite.config.ts`
- Create: `vite.lib.config.ts`
- Create: `vitest.config.ts`
- Create: `src/core/coordinates.ts`
- Create: `tests/coordinates.test.ts`

**Interfaces:**
- Produces: `UvPoint`, `DomPoint`, `DomSize`, `uvToDomPoint(uv, size)`, `copyAndTransformUv(uv, transform?)`

- [x] **Step 1: packageとbuild設定を作る**

`package.json`のscriptsを次に固定する。

```json
{
  "name": "html-surface-three",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "HTMLElementを操作可能なThree.js Mesh表面として管理する実験的ライブラリ",
  "main": "./dist/html-surface-three.js",
  "module": "./dist/html-surface-three.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/html-surface-three.js"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build:lib": "vite build --config vite.lib.config.ts && tsc -p tsconfig.lib.json",
    "build:demo": "vite build",
    "build": "npm run typecheck && npm run test && npm run build:lib && npm run build:demo",
    "preview": "vite preview"
  },
  "peerDependencies": {
    "three": ">=0.184.0 <0.186.0"
  },
  "dependencies": {
    "three-html-render": "^0.1.2"
  },
  "devDependencies": {
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.185.0",
    "@vitejs/plugin-react": "^6.0.4",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "three": "^0.185.1",
    "typescript": "^7.0.2",
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  }
}
```

Vite library buildは`src/index.ts`をentryとし、`three`と`three-html-render`で始まるimportをexternalにする。demo buildは`dist-demo`へ出力し、libraryの`dist`を上書きしない。

- [x] **Step 2: UV変換の失敗テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { copyAndTransformUv, uvToDomPoint } from '../src/core/coordinates';

describe('uvToDomPoint', () => {
  it('変換済みUVをDOMピクセル座標へ写像する', () => {
    expect(uvToDomPoint({ x: 0.25, y: 0.75 }, { width: 800, height: 400 }))
      .toEqual({ x: 200, y: 300 });
  });

  it('Surface固有のUV変換を元のUVを変更せず適用する', () => {
    const source = { x: 0.2, y: 0.3 };
    const result = copyAndTransformUv(source, (uv) => {
      uv.x = 1 - uv.x;
      uv.y = 1 - uv.y;
    });
    expect(result).toEqual({ x: 0.8, y: 0.7 });
    expect(source).toEqual({ x: 0.2, y: 0.3 });
  });
});
```

- [x] **Step 3: テストがexport未定義で失敗することを確認する**

Run: `npm install && npm test -- tests/coordinates.test.ts`

Expected: `coordinates` moduleまたはexportが存在しないためFAIL。

- [x] **Step 4: 最小実装を追加する**

```ts
export type UvPoint = { x: number; y: number };
export type DomPoint = { x: number; y: number };
export type DomSize = { width: number; height: number };
export type UvTransform = (uv: UvPoint) => void;

export function copyAndTransformUv(uv: UvPoint, transform?: UvTransform): UvPoint {
  const result = { x: uv.x, y: uv.y };
  transform?.(result);
  return result;
}

export function uvToDomPoint(uv: UvPoint, size: DomSize): DomPoint {
  return { x: uv.x * size.width, y: uv.y * size.height };
}
```

- [x] **Step 5: 座標テストとtypecheckを通す**

Run: `npm test -- tests/coordinates.test.ts && npm run typecheck`

Expected: 全テストPASS、TypeScript error 0。

### Task 2: 最前面判定とHTML Surface管理

**Files:**
- Create: `src/core/hit-test.ts`
- Create: `tests/hit-test.test.ts`
- Create: `src/backends/html-texture-backend.ts`
- Create: `src/HtmlSurfaceManager.ts`
- Create: `src/index.ts`

**Interfaces:**
- Consumes: `UvPoint`, `uvToDomPoint`, `copyAndTransformUv`
- Produces: `resolveFrontmostHit()`, `createHtmlTextureBackend()`, `HtmlSurfaceManager`, `HtmlSurface`, `HtmlSurfaceOptions`, `HtmlSurfaceDebugState`

- [x] **Step 1: 遮蔽判定の失敗テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { resolveFrontmostHit } from '../src/core/hit-test';

type ObjectRef = { name: string; ignored?: boolean };
type SurfaceRef = { id: string };

const panel = { name: 'panel' };
const blocker = { name: 'blocker' };
const surface = { id: 'panel-surface' };

describe('resolveFrontmostHit', () => {
  it('最前面がSurfaceならUV付きSurface hitを返す', () => {
    const result = resolveFrontmostHit(
      [{ distance: 1, object: panel, uv: { x: 0.4, y: 0.6 } }],
      (object) => object === panel ? surface : undefined,
      (object) => object.ignored === true,
    );
    expect(result.kind).toBe('surface');
  });

  it('Surfaceより手前の通常Meshを遮蔽物として返す', () => {
    const result = resolveFrontmostHit(
      [
        { distance: 0.5, object: blocker, uv: { x: 0.1, y: 0.1 } },
        { distance: 1, object: panel, uv: { x: 0.4, y: 0.6 } },
      ],
      (object) => object === panel ? surface : undefined,
      (object) => object.ignored === true,
    );
    expect(result).toEqual(expect.objectContaining({ kind: 'blocked', hit: expect.objectContaining({ object: blocker }) }));
  });

  it('ignore指定の交差を飛ばす', () => {
    const ignored = { name: 'helper', ignored: true };
    const result = resolveFrontmostHit(
      [
        { distance: 0.2, object: ignored },
        { distance: 1, object: panel, uv: { x: 0.4, y: 0.6 } },
      ],
      (object) => object === panel ? surface : undefined,
      (object) => object.ignored === true,
    );
    expect(result.kind).toBe('surface');
  });
});
```

- [x] **Step 2: 最前面判定を実装する**

`resolveFrontmostHit`はdistance昇順の交差を走査し、ignore対象を飛ばす。最初の有効交差がSurfaceでUVを持てば`surface`、Surfaceでなければ`blocked`、有効交差がなければ`none`を返す。SurfaceにUVがない場合は誤入力を防ぐため`blocked`にする。

- [x] **Step 3: backend境界を実装する**

`HtmlTextureBackend`は次の契約にする。

```ts
export type BackendKind = 'native' | 'polyfill';

export type HtmlTextureHandle = {
  texture: Texture;
  invalidate(): void;
  dispose(): void;
};

export type HtmlTextureBackend = {
  readonly kind: BackendKind;
  mount(element: HTMLElement): HtmlTextureHandle;
  requestPaint(): void;
};
```

`createHtmlTextureBackend(canvas)`はpolyfill導入前に`requestPaint`とWebGLの`texElementImage2D`を検出して`kind`を決める。未対応時だけ`installHtmlInCanvasPolyfill()`を呼び、Canvasへ`layoutsubtree`属性を追加する。`mount()`はHTMLElementをCanvasの子へ追加し、`three-html-render/html-texture`の`HTMLTexture`を生成する。disposeはTextureとDOMを一度だけ解放する。

- [x] **Step 4: `HtmlSurfaceManager`の縦切りを実装する**

公開する最小オプションは次とする。

```ts
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
```

Manager constructorは`renderer`、`camera`、`scene`、任意backendを受け取る。`add()`はTextureを生成し、選択したMaterialの`mapProperty`へ適用し、以前の値を保存する。Raycastは`scene.children`をrecursiveに調べ、最前面が登録SurfaceのMeshまたは子孫の場合だけDOMをポインター下へ移動する。

DOM座標は`texture.transformUv()`または`transformUv`を適用した後、`uvToDomPoint()`で求める。遮蔽時は全Surface elementを`translate(-100000px, 0)`へ退避する。Surface要素のpointerイベントはControlsへbubbleさせず、Canvas上のwheelは該当Surface内のscrollable要素へ送る。

`dispose()`はイベントリスナーを外し、全Surfaceをdisposeする。Surface disposeはMaterial mapを元に戻し、指定された所有物だけを破棄する。

- [x] **Step 5: coreテスト、typecheck、library buildを通す**

Run: `npm test && npm run typecheck && npm run build:lib`

Expected: 全テストPASS、TypeScript error 0、`dist/html-surface-three.js`と`dist/index.d.ts`が生成される。

### Task 3: React／Vanillaの操作可能デモ

**Files:**
- Create: `index.html`
- Create: `src/demo/ControlPanel.tsx`
- Create: `src/demo/main.tsx`
- Create: `src/demo/styles.css`

**Interfaces:**
- Consumes: `HtmlSurfaceManager`
- Produces: stable Chromiumで操作可能なReact Surface、Vanilla Surface、遮蔽物、診断HUD

- [ ] **Step 1: HTML entryとCSSを作る**

`index.html`には`canvas#scene`、`aside#hud`、WebGL失敗時の`div#fallback`を置き、`/src/demo/main.tsx`をmoduleとして読む。`.surface-source`は固定width／height、背景色、フォーム部品、スクロール領域を自身のclassだけでスタイルし、Canvas親セレクターへ依存させない。

- [ ] **Step 2: React操作パネルを作る**

`ControlPanel`は次を持つ。

- クリック回数を更新する`button[data-testid="react-action"]`
- 入力値を表示する`input[data-testid="react-input"]`
- `overflow-y: auto`かつ固定高の`section[data-testid="react-scroll"]`
- backend種別の表示

状態更新はReactの`useState`だけで行い、コアライブラリ固有hookは作らない。

- [ ] **Step 3: Three.jsシーンと2つのSurfaceを作る**

React elementは640×420、Vanilla elementは360×240とする。React panelはモニターのPlaneGeometryへ、Vanilla panelは別の傾いたPlaneGeometryへ登録する。React rootはSurface登録後にmountし、入力guardがReactのdelegated listenerより先に登録される順序にする。

遮蔽物はReact panelよりカメラ側を左右に往復するBoxGeometryとし、`object.userData.htmlSurfaceRaycast = 'occluder'`を設定する。床、モニターフレーム、ライト、OrbitControlsを追加し、UI上のpointerdownだけControlsへ渡らないことを確認する。

HUDはbackend、hit kind、object名、surface ID、UV、DOM座標を表示する。HUD自体は検証用で、library APIに含めない。

- [ ] **Step 4: demo buildを通す**

Run: `npm run build:demo`

Expected: `dist-demo/index.html`とassetが生成され、build error 0。

- [ ] **Step 5: stable Chromiumで縦切りを確認する**

Run: `npm run dev -- --host 127.0.0.1`

確認項目:

- Reactボタンが1回の通常クリックで更新される
- inputへ`surface`と入力でき、表示とTextureが更新される
- Reactスクロール領域がwheelで動く
- Vanillaボタンが動く
- 遮蔽物が前面にある間、Reactボタンを操作できない
- パネル外ではOrbitControlsが動く
- HUDがpolyfillと座標を表示する

### Task 4: README、最終検証、privateリポジトリ反映

**Files:**
- Create: `README.md`
- Modify: 実装結果に応じてTask 1〜3のファイルを最小修正

**Interfaces:**
- Produces: 第三者が試せる日本語ドキュメントと検証済み成果物

- [ ] **Step 1: READMEを書く**

READMEに以下をこの順で記載する。

1. HTML Surfaceの定義
2. ライブラリ概要
3. 既存技術調査と作る価値
4. 実現できたこと
5. 現時点の制約
6. Canvas UI、Three.js HTMLTexture／HTMLMesh、three-html-render、Drei Html、3DネイティブUIとの違い
7. 今後追加すべき機能
8. `npm install`、`npm run dev`、`npm run build`による実行方法
9. Vanilla APIの使用例
10. Reactは通常のHTMLElementを作るだけという使用例

- [ ] **Step 2: 全検証を実行する**

Run: `npm run build`

Expected: typecheck、unit test、library build、demo buildがすべて成功する。

- [ ] **Step 3: ブラウザを再確認する**

stable ChromiumでTask 3の確認項目を再実行し、console errorとuncaught exceptionが0であることを確認する。視覚状態をスクリーンショットで確認する。

- [ ] **Step 4: 差分をレビューしてコミット・pushする**

Run:

```powershell
git diff --check
git status --short
git add package.json package-lock.json tsconfig.json tsconfig.lib.json vite.config.ts vite.lib.config.ts vitest.config.ts index.html src tests README.md docs
git commit -m "feat: HTML Surfaceプロトタイプを実装"
git push
```

Expected: privateリポジトリの`main`が実装コミットを指し、worktreeがcleanになる。
