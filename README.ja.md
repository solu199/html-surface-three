<h1 align="center">HTML Surface Three</h1>

<p align="center">
  HTMLやReactのUIを、UV変換・遮蔽・ブラウザ入力・ライフサイクルを保ったまま、実際のThree.js Meshへ表示します。
</p>

<p align="center">
  <a href="https://solu199.github.io/html-surface-three/"><strong>ライブデモ</strong></a>
  ·
  <a href="https://github.com/solu199/html-surface-three#readme">English</a>
  ·
  <a href="https://github.com/solu199/html-surface-three/blob/main/docs/api.md">API</a>
  ·
  <a href="https://github.com/solu199/html-surface-three/blob/main/docs/browser-support.md">ブラウザ対応</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/html-surface-three"><img alt="npm version" src="https://img.shields.io/npm/v/html-surface-three?color=59d8c4"></a>
  <a href="https://github.com/solu199/html-surface-three/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/solu199/html-surface-three/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/solu199/html-surface-three/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/npm/l/html-surface-three"></a>
  <img alt="Three.js r184 to r185" src="https://img.shields.io/badge/three.js-r184%E2%80%93r185-111111">
</p>

<p align="center">
  <a href="https://solu199.github.io/html-surface-three/">
    <img alt="動くThree.jsモニター上のReact操作パネルとUV・入力診断" src="https://raw.githubusercontent.com/solu199/html-surface-three/main/.github/readme.gif" width="1200">
  </a>
</p>

## HTML Surfaceとは

**HTML Surface**は単なるHTML Textureではありません。`HTMLElement`を描画ソース、Three.js `Mesh`を表示対象として、次を一つの単位で管理する抽象化です。

- HTML由来Textureの生成と更新
- Materialスロット、map property、Texture transformとの関連付け
- Raycast交差UVからDOM座標への変換
- ブラウザ由来のhit testing、focus、keyboard、pointer、wheel、touch入力
- 通常のscene Meshによる入力遮蔽
- 複数Surface、所有権、復元、破棄

HTML-in-Canvas、Three.js `HTMLTexture`、`three-html-render`は交換可能な描画Backendまたは低レベル基盤です。本ライブラリの価値はその上にあり、任意のUV付きMeshへのBinding、sceneを通した入力、Surface全体のライフサイクルを協調管理します。

## HTML Textureとの違い

| 描画primitiveが提供するもの | HTML Surface Threeが追加するもの |
|---|---|
| DOM → pixels | Backend選択と明示的な再描画 |
| Texture | Mesh、Materialスロット、map property、UV変換とのBinding |
| 見た目 | UV → DOM targetingとブラウザ操作 |
| 一つの描画要素 | 複数Surfaceのregistryと所有権 |
| 描画時のMesh深度 | 入力にも同じscene遮蔽を適用 |

DOMオーバーレイではありません。UIはTextureとしてアップロードされるため、Mesh変形、遠近、深度、遮蔽へ参加します。

## インストール

```bash
npm install html-surface-three three@0.185.1
```

必要環境:

- Node.js `^20.19.0`または`>=22.12.0`
- Three.js `>=0.184.0 <0.186.0`
- WebGLを利用できるstableブラウザ

## Vanilla API

コアはframework非依存です。実DOMの`HTMLElement`と、UVを持つ既存MeshをManagerへ渡します。

```ts
import * as THREE from 'three';
import { HtmlSurfaceManager } from 'html-surface-three';

const panel = document.createElement('section');
panel.style.cssText = 'width: 640px; height: 420px';
panel.innerHTML = `
  <button type="button">Run action</button>
  <label>Signal <input aria-label="Signal" /></label>
  <div style="height: 120px; overflow: auto">...</div>
`;

const manager = new HtmlSurfaceManager({
  renderer,
  camera,
  scene,
  backend: 'auto',
  raycastRoots: [world, uiSurfaces],
});

const surface = manager.add({
  id: 'monitor',
  element: panel,
  mesh: monitorScreen,
  materialIndex: 0,
  mapProperty: 'map',
  transformUv(uv, texture) {
    texture.transformUv(uv);
  },
});

function frame() {
  manager.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

await surface.ready;

surface.dispose();
manager.dispose();
```

`disposeMaterial`と`disposeGeometry`は既定で`false`です。利用者所有のThree.js resourceを暗黙に破棄しません。

DOM mutationと`input`、`change`、`scroll`、`compositionend`はTextureを自動更新します。外部assetやcanvasなど、DOMから観測できない描画変更だけ`surface.invalidate()`で通知してください。

## Reactパネル

Reactは統合例であり、コア依存ではありません。通常のHTMLElementへmountし、同じVanilla APIへ渡します。

```tsx
import { createRoot } from 'react-dom/client';

const element = document.createElement('div');
element.style.cssText = 'width: 640px; height: 420px';

const surface = manager.add({
  id: 'react-monitor',
  element,
  mesh: monitorScreen,
});

const root = createRoot(element);
root.render(<ControlPanel />);

root.unmount();
surface.dispose();
```

ライブデモでは、navigation、button状態、text input、checkbox、range drag、scrollを含むReactサイト全体を、動き・回転する3Dモニターへ表示します。別のVanilla Surfaceで複数Surfaceと遮蔽も確認できます。

## Raycast性能

既定は`scene.children`を再帰Raycastします。大規模sceneでは、重複しないrootの配列を`raycastRoots`に渡して対象を限定できます。Managerは毎回同じ配列を読むため、sceneの変化に合わせて配列を更新できます。操作対象のSurfaceと遮蔽に使うobjectは、すべていずれかのroot配下に置いてください。空配列はpointer hitを無効化します。

## Backend

| 指定 | 挙動 |
|---|---|
| `auto` | stable優先。native実験APIが存在してもpolyfillを使用 |
| `polyfill` | `three-html-render`を明示使用 |
| `native` | native HTML-in-Canvasを検出できる場合だけ使用。experimental |

Backend SPIは`html-surface-three/experimental`へ隔離し、stable facadeをThree.jsの実験APIへ強く結合しません。詳細は[Texture Backend](https://github.com/solu199/html-surface-three/blob/main/docs/backends.md)を参照してください。

## ブラウザ保証

段階保証を採用しています。

| Tier | ブラウザ | 範囲 |
|---|---|---|
| Tier 1 | stable Chrome／Edge | moving／rotation、navigation、button、input、keyboard、IME composition、checkbox、range drag、scroll、複数Surface、遮蔽、pointer capture、touch |
| Tier 2 | Playwright Firefox／WebKit | 起動、表示、button、input、scrollのsmoke |
| 手動 | 実Safari | 公開checklist。Playwright WebKitをSafari保証とは扱わない |
| Experimental | native HTML-in-Canvas環境 | 検出と明示選択のみ |

既定Backendはstableなpolyfill経路です。詳細は[ブラウザ互換性](https://github.com/solu199/html-surface-three/blob/main/docs/browser-support.md)を参照してください。

## 現時点の制約

- polyfillはSVG `foreignObject`とTexture uploadのコストを持つ
- CORS media、iframe、DRM、複雑なCSS、native form外観はブラウザ制約を受ける
- UV重複、別UV channel、`SkinnedMesh`、`InstancedMesh`はstable保証外
- 大規模sceneでは`raycastRoots`でrecursive Raycastを限定する
- DOMアクセシビリティツリーと3D上の見た目の位置は一致しない
- React Three Fiber／WebXR Adapterは将来機能

詳細と回避案は[現時点の制約](https://github.com/solu199/html-surface-three/blob/main/docs/limitations.md)を参照してください。

## ドキュメント

- [APIリファレンス](https://github.com/solu199/html-surface-three/blob/main/docs/api.md)
- [Texture Backend](https://github.com/solu199/html-surface-three/blob/main/docs/backends.md)
- [ブラウザ互換性](https://github.com/solu199/html-surface-three/blob/main/docs/browser-support.md)
- [現時点の制約](https://github.com/solu199/html-surface-three/blob/main/docs/limitations.md)
- [プロトタイプからの移行](https://github.com/solu199/html-surface-three/blob/main/docs/migration-rc1.md)
- [関連技術調査](https://github.com/solu199/html-surface-three/blob/main/docs/research/2026-07-24-html-surface-landscape.md)
- [変更履歴](https://github.com/solu199/html-surface-three/blob/main/CHANGELOG.md)

## 開発

```bash
npm install
npm run dev

npm run typecheck
npm test
npm run build
npm run test:e2e:tier1
npm run test:e2e:smoke
npm run test:visual
npm run verify:package
```

- library ESMと型宣言: `dist/`
- production demo: `dist-demo/`
- browser証跡: `artifacts/`

Pull Request前に[CONTRIBUTING](https://github.com/solu199/html-surface-three/blob/main/.github/CONTRIBUTING.md)を参照してください。脆弱性は[SECURITY](https://github.com/solu199/html-surface-three/blob/main/.github/SECURITY.md)の手順で非公開報告してください。

## 非目標

HTMLラスタライザー、UIコンポーネント集、DOMオーバーレイ、React専用ライブラリ、画像／動画decoder、media playerではありません。

## License

[MIT](https://github.com/solu199/html-surface-three/blob/main/LICENSE)
