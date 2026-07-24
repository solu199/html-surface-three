# HTML Surface Three プロトタイプ設計

## 1. 目的

HTMLまたはReactで作られたUIを、単なる画面上のDOMオーバーレイではなく、Three.jsの任意Meshに貼られたテクスチャとして表示し、3D空間から操作できる実験的ライブラリを作る。

最初の成果物は、stable版の主要ブラウザで次を確認できる最小限の縦切りプロトタイプとする。

- HTML UIがThree.jsのMesh表面にテクスチャとして表示される
- ボタン、テキスト入力、スクロール領域を3D空間から操作できる
- Raycastで得たUVをHTML内の座標へ対応付けられる
- 手前の3Dオブジェクトが表示と入力の両方を遮蔽する
- 複数のHTMLサーフェスを同じ管理単位で扱える
- HTML-in-Canvas対応時はnative経路、未対応時はpolyfill経路を選べる
- Vanilla APIを中核とし、ReactDOMで生成したUIも同じAPIへ渡せる

ライブラリ名と公開APIはプロトタイプ期間中の仮称とする。実装中に責務分割が不自然だと判明した場合は、互換性よりも小さく理解しやすい構成を優先して変更する。

## 2. 調査結果と作る価値

### 2.1 関連技術

- [WICG HTML-in-Canvas](https://github.com/WICG/html-in-canvas) は、Canvas配下のHTMLを2D Canvas、WebGL、WebGPUへ描画し、HTML側を描画位置へ整列させてブラウザ本来のhit testingを利用する提案である。2026年7月時点ではChromiumの実験機能であり、全利用者にそのまま提供できる段階ではない。
- [Three.js `HTMLTexture`](https://threejs.org/docs/pages/HTMLTexture.html) はHTML要素をTextureとして扱い、親Canvasのpaintイベントから更新する。r185にはHTML-in-Canvas API変更への追従が含まれる。
- Three.jsの`InteractionManager`は、HTML要素をMesh前面へCSS `matrix3d`で整列させ、ブラウザ本来のDOMイベントを利用する。ただし標準実装は主に単一平面を想定する。
- [Three.js `HTMLMesh`](https://threejs.org/docs/pages/HTMLMesh.html) はDOMをCanvasTextureへ変換できるが、独自の簡易HTML描画であるため、一般的なCSSやフォーム再現には限界がある。
- [`three-html-render`](https://github.com/repalash/three-html-render) はHTML-in-Canvasのpolyfill、Three.js互換の`HTMLTexture`、平面向けとRaycast向けのInteractionManagerを提供する。SVG `foreignObject`によるstableブラウザ向けフォールバックや、曲面上の操作にも対応している。
- [Drei `Html`](https://drei.docs.pmnd.rs/misc/html) と[Babylon.js HtmlMesh](https://doc.babylonjs.com/addons/htmlMesh)は、CSS変形や深度マスクを使ってDOMと3Dを重ねる方式が中心で、実際のMeshテクスチャとは性質が異なる。通常のDOM操作には強い一方、WebXRや任意のMesh変形では制約がある。
- [Canvas UI](https://canvasui.dev/docs) は、HTML-in-Canvasを利用してライブHTMLへWebGLエフェクトを重ねるクリエイティブコンポーネント集である。主眼はページ表現とエフェクトであり、3Dモデルの任意Meshを操作可能なUIサーフェスとして管理することではない。
- `three-mesh-ui`や`@react-three/uikit`などは3DネイティブのUI部品を構築する。WebXRとの相性は良いが、既存のHTML／CSS／Reactコンポーネントをそのまま利用する方式ではない。

### 2.2 独自価値

HTMLのラスタライズ技術自体は再実装しない。本プロトタイプの価値は、既存の描画プリミティブを利用して次の問題を一つの小さなAPI境界で扱うことに置く。

- HTMLElementと任意のThree.js Meshを関連付ける
- UV座標とDOM座標の関係を明示的に扱う
- UI Mesh以外の遮蔽物を含む、シーン全体の最前面判定を行う
- 複数サーフェス間でhover、focus、pointer、wheelの送り先を切り替える
- DOM、Texture、Material、Geometry、イベントリスナーの所有権と破棄順序を管理する
- native API、polyfill、将来の別レンダラーを差し替えられる境界を保つ

## 3. 採用方針

### 3.1 ハイブリッド・サーフェス層

描画にはThree.jsのTexture機構と`three-html-render`のstableブラウザ向けpolyfillを利用する。ライブラリはその上に、サーフェス登録と入力ルーティングを提供する。

プロトタイプではThree.js r185を開発・検証対象とするが、r185固有クラスをコア全体へ漏らさない。HTMLテクスチャ作成は小さなアダプター関数またはインターフェースの背後へ閉じ込める。

native HTML-in-Canvasが利用可能な場合はnative経路を優先し、利用できない場合はpolyfillをインストールする。どちらの経路でも、サーフェス管理側のAPIは変えない。

### 3.2 最初の縦切り

最初に以下を一連で完成させる。

1. ReactDOMで操作パネルをHTMLElementへマウントする
2. そのHTMLElementからHTML Textureを作る
3. Textureをモニター形状のMeshへ関連付ける
4. PointerEventをシーン全体へRaycastする
5. 最前面ヒットが登録済みUI Meshの場合だけ、UVをDOM座標へ変換して操作を送る
6. ボタン、入力欄、スクロールを実際に操作する
7. サーフェスを破棄し、DOMとGPUリソースとイベントリスナーを解放する

CapabilityReport、詳細な診断UI、React Three Fiberアダプターなどは、この縦切りが動いた後にのみ追加する。

## 4. 仮の構成

責務名は実装前の仮称であり、各ファイルが小さいままであれば統合してよい。逆に、入力状態や所有権が複雑になった場合のみ分割する。

### 4.1 サーフェス

サーフェスは最低限、次の情報を持つ。

- 一意なID
- sourceとなるHTMLElement
- UIを表示するMesh
- HTML由来のTexture
- UVからDOM座標への変換設定
- Texture、Material、Geometryを誰が所有し、誰が破棄するか

想定APIは次の程度から始める。

```ts
const surface = manager.add({
  element,
  mesh,
  textureFactory,
});

surface.invalidate();
surface.dispose();
```

Mesh生成を強制しない。利用者が用意した既存Meshへ関連付けられることを基本とし、デモ向けの便利関数はコア外へ置く。

### 4.2 Texture作成境界

Texture作成は次のような小さな契約に閉じ込める。

```ts
type SurfaceTextureHandle = {
  texture: THREE.Texture;
  invalidate(): void;
  dispose(): void;
};

type SurfaceTextureFactory = (
  element: HTMLElement,
  context: { canvas: HTMLCanvasElement },
) => SurfaceTextureHandle;
```

実際の実装では`three-html-render`とThree.jsの型に合わせて簡略化してよい。重要なのは、サーフェス管理と入力ルーティングがHTML-in-Canvasの具体的なAPIシグネチャを知らないことである。

### 4.3 入力ルーティング

入力ルーティングはrendererのCanvas上でPointerEventとWheelEventを受け取る。

1. Canvas座標をNDCへ変換する
2. UI Meshだけでなく、入力を遮蔽し得るシーンオブジェクトも含めてRaycastする
3. 最も手前の有効なヒットを選ぶ
4. そのヒットが登録済みUI Meshで、UVを持つ場合だけ操作対象にする
5. `u * width`、`(1 - v) * height`を基準にDOM座標へ変換する
6. 実DOMをポインター位置へ一時的に整列させ、可能な限りブラウザ本来のhit testing、focus、selectionを利用する
7. 遮蔽物が手前に来た場合、DOMを退避して`pointer-events`を無効にする

UVの向きやTexture transformはMeshごとに異なる可能性がある。初期実装ではThree.js Textureの標準UV変換を適用し、必要なら利用者がUV変換関数を差し込めるようにする。

`OrbitControls`との競合は、UIを操作しているPointerだけをCanvas操作から抑止する。常にControlsを停止する実装にはしない。

### 4.4 複数サーフェス

管理単位は一つのrenderer、camera、sceneに接続し、複数サーフェスを登録できるようにする。

同じPointerに対してアクティブになるDOMサーフェスは一つだけとし、それ以外のDOMは画面外へ退避する。Pointer capture中は開始時のサーフェスを維持し、pointerupまたはpointercancelで解除する。

複数renderer、複数camera、XR controller rayは最初の縦切りに含めない。ただし、入力ルーティングの内部を「スクリーン座標からRayを作る処理」と「Rayからサーフェスを選ぶ処理」に分けられる形にし、将来XR Rayを渡せる余地を残す。

### 4.5 Reactの扱い

コアはReactを依存関係に持たない。デモ側で次のようにReactDOMを通常のHTMLElementへマウントし、その要素をVanilla APIへ渡す。

```tsx
const element = document.createElement('div');
const root = createRoot(element);
root.render(<ControlPanel />);

const surface = manager.add({ element, mesh });
```

破棄時は、サーフェスを先に入力管理から外し、React rootをunmountし、DOMホストからelementを外す。

## 5. デモ

デモはViteで実行する単一ページとし、次を一画面で確認できるようにする。

- Three.jsシーン内のモニターまたは操作パネル
- React製UI
  - 状態が変わるボタン
  - テキスト入力
  - 複数行のスクロール領域
  - 操作結果の表示
- UI表面を一部覆う、移動可能または自動移動する遮蔽物
- カメラ操作用OrbitControls
- 現在の描画経路、ヒットしたMesh、UV、DOM座標の小さな診断表示
- Vanilla HTMLから作る2つ目の小さなサーフェス

診断表示はプロトタイプ検証用であり、初期公開APIへ含めない。

## 6. エラー処理とフォールバック

- WebGLを作成できない場合は、3Dデモを開始せず理由をDOMへ表示する
- HTML-in-Canvasが利用できない場合はpolyfill経路へ移る
- polyfill初期化にも失敗した場合は、HTML要素を通常の2D DOMとして表示し、3D操作が利用できないことを示す
- Raycast結果にUVがないMeshは操作対象外とし、開発時に一度だけ警告する
- 0サイズのHTMLElementは登録時にエラーとし、必要なwidthとheightを案内する
- Texture生成の非同期更新中は直前フレームのTextureを維持する
- サーフェス破棄は複数回呼んでも安全にする

## 7. 検証方針

新規テストは、3D入力の基礎となる共有ロジックに限定して追加する。見た目そのものはブラウザ操作で確認する。

### 7.1 自動テスト

- UVからDOM座標への変換
- Texture transformを含むUV変換
- 複数交差から最前面サーフェスまたは遮蔽物を選ぶ処理
- 登録、削除、二重disposeのライフサイクル

### 7.2 ブラウザ検証

stable版Chromiumで次を操作する。

- ボタンをクリックするとReact状態が更新され、Textureにも反映される
- 入力欄へフォーカスして文字を入力できる
- Wheelでスクロール領域が動く
- OrbitControlsとUI操作を切り替えられる
- 遮蔽物の背後ではクリックできず、手前へ出ると再び操作できる
- 複数サーフェス間でhoverとfocusが誤送信されない

可能であればFirefoxでもpolyfill経路の起動を確認する。WebXRは今回の完了条件に含めない。

## 8. 現時点で受け入れる制約

- polyfill経路はSVG `foreignObject`による再描画とGPU uploadを含み、native経路より高コストである
- CSS、form controlの見た目、textarea内部スクロール、contenteditable、`:visited`などはpolyfillの制約を受ける
- クロスオリジン画像、iframe、動画、DRMコンテンツを完全にTexture化できるとは限らない
- UVが重複するMeshやUVを持たないGeometryは、追加のマッピング情報なしでは正しく操作できない
- 極端に歪んだ三角形や高頻度に変形するSkinnedMeshでは、DOM overlayとTextureの見え方に差が出る可能性がある
- ブラウザのアクセシビリティツリーには実DOMを残せるが、3D上の視覚位置と読み上げ順序が自然に一致する保証はない
- WebXRコントローラー、ハンドトラッキング、ソフトウェアキーボードは将来対応とする

## 9. 実装後に判断する事項

最初の縦切りを動かした後、実測とコードの複雑さを見て次を判断する。

- `HtmlSurface`をクラスにするか、単純なrecordとdispose関数にするか
- Texture factoryを公開インターフェースにするか、内部関数に留めるか
- 入力ルーターと複数サーフェス管理を同じクラスに置くか分離するか
- `CapabilityReport`を公開APIにするか、デモの診断値に留めるか
- DOMをポインター位置へ移動する方式を維持するか、特定イベントだけUVから再送する方式を併用するか
- React Three Fiber用hook／componentを別packageにするか、例だけ提供するか

## 10. 完了条件

- `npm install`と`npm run dev`で第三者がデモを起動できる
- `npm run build`と自動テストが成功する
- stable ChromiumでReact UIとVanilla UIを3D表面から操作できる
- 遮蔽物が表示と入力の両方を遮る
- READMEに概要、実現できたこと、制約、既存技術との差、今後の機能、実行方法、使用例を日本語で記載する
- private GitHubリポジトリへソースと文書が保存される
