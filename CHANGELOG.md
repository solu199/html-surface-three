# 変更履歴

## 0.1.0-rc.2

公開日: 2026-07-25

### 修正

- polyfill BackendでSurface hostがcanvas fallback subtreeへ再配置された場合に、canvasへ登録されたcapture listenerがDOM activationを遮断し、buttonなどのclick handlerが実行されない問題を修正しました（[#6](https://github.com/solu199/html-surface-three/issues/6)）。

## 0.1.0-rc.1

公開日: 2026-07-24

最初の公開リリース候補です。npmでは`next` dist-tagから導入できます。

### 追加

- HTMLElementと任意のThree.js Meshを一単位で管理するHTML Surface
- Materialスロット、Texture適用プロパティ、UV変換を含むBinding
- scene内の通常Meshを考慮する遮蔽判定
- pointer、focus、keyboard、IME、wheel、scroll、drag、touchの入力ルーティング
- Pointer Captureと動くMeshへの毎フレーム追従
- 一つのManagerによる複数Surface管理と所有権に基づく破棄
- stableブラウザ優先のpolyfill Backendと明示選択式native Backend
- CapabilityReport、型付きエラー、診断状態
- 動く3Dモニター上のReactサイトとVanilla診断Surface
- Unit／Integration、Chrome／Edge E2E、Firefox／WebKit smoke、視覚回帰テスト
- ESM package、型宣言、tarball consumer検証、GitHub Actions
- 英語／日本語README、GitHub Pagesライブデモ、公開コントリビューション導線
- npm Trusted Publishingとprovenance対応の公開workflow

### 互換性

- Three.js `>=0.184.0 <0.186.0`
- Node.js `^20.19.0 || >=22.12.0`
- Tier 1: stable Chrome、stable Edge
- Tier 2: stable Firefox、Playwright WebKit

### 既知の制約

- native HTML-in-Canvas経路は実験扱いです。
- polyfill経路はSVG `foreignObject`による描画とTexture uploadのコストを持ちます。
- iframe、DRM、クロスオリジンメディアを完全にTexture化する機能はありません。
- React Three Fiber AdapterとWebXR入力は将来機能です。
