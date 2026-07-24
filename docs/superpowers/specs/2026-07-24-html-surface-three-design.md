# HTML Surface Three プロトタイプ設計

## 1. HTML Surfaceの定義

**HTML Surface**とは、HTMLElementを描画ソース、Three.js Meshを表示対象として、テクスチャ生成、Materialへの適用、UV／DOM座標変換、入力ルーティング、遮蔽判定、ライフサイクルを一つの単位として管理する抽象化である。

HTML Surfaceは単なるHTML Textureではない。TextureはHTML Surfaceを構成する交換可能な描画結果の一つであり、HTML-in-Canvas、Three.js `HTMLTexture`、`three-html-render`は交換可能な描画バックエンドまたは低レベル基盤として扱う。本ライブラリの主語と公開概念はHTML Surfaceとする。

HTML Surfaceが任意Meshへ関連付けられるとは、Meshを識別できるだけでなく、次を管理できることを意味する。

- 生成したTextureをどのMaterialのどのmapへ適用するか
- 既存Materialを変更するか、専用Materialを所有するか
- Three.jsのTexture transformと利用者指定の変換を含め、交差点のUVをHTML内の座標へどう写像するか
- Material、Texture、Geometryのうち、HTML Surfaceがどれを所有して破棄するか

画像と動画はHTML Surfaceの主要な応用対象とする。`HTMLImageElement`や`HTMLVideoElement`を単独で表示する場合は、HTML-in-Canvasによる再ラスタライズを必須にせず、Three.jsの画像／動画向けTexture経路を選べるようにする。一方、画像や動画をテキスト、フォーム、再生コントロールなどと一つのHTMLレイアウトとして合成する場合は、HTML-in-Canvasまたはpolyfill経路を利用する。どちらの場合も、Meshとの関連付け、Material適用、UV変換、遮蔽、ライフサイクルは同じサーフェス管理層を再利用する。

公開APIの細部は、プロトタイプで実際の所有権と入力状態を検証した後に決める。

## 2. 目的

HTMLまたはReactで作られたUIを、単なる画面上のDOMオーバーレイではなく、Three.jsの任意Meshに貼られたテクスチャとして表示し、3D空間から操作できる実験的ライブラリを作る。

最初の成果物は、stable版の主要ブラウザで次を確認できる最小限の縦切りプロトタイプとする。

- HTML UIがThree.jsのMesh表面にテクスチャとして表示される
- ボタン、テキスト入力、スクロール領域を3D空間から操作できる
- Raycastで得たUVをHTML内の座標へ対応付けられる
- 手前の3Dオブジェクトが表示と入力の両方を遮蔽する
- 複数のHTMLサーフェスを同じ管理単位で扱える
- HTML-in-Canvas対応時はnative経路、未対応時はpolyfill経路を選べる
- Vanilla APIを中核とし、ReactDOMで生成したUIも同じAPIへ渡せる

公開リリースまでには、単独の画像、単独の動画、HTMLとメディアを合成したUIへ応用しやすい描画ソース境界を整える。メディア対応のためにサーフェス管理、UV変換、遮蔽判定を作り直す必要がない状態を目標とする。

ライブラリ名と公開APIはプロトタイプ期間中の仮称とする。実装中に責務分割が不自然だと判明した場合は、互換性よりも小さく理解しやすい構成を優先して変更する。

## 3. 非目標

本ライブラリは次のものを目指さない。

- HTMLラスタライザーの再実装
- ボタンやフォームなどのUIコンポーネント集
- 3D位置へDOMを重ねて見せるDOMオーバーレイライブラリ
- ReactまたはReact Three Fiber専用ライブラリ
- HTML-in-Canvas API自体のpolyfill
- 画像デコーダ、動画デコーダ、メディアプレイヤーの再実装

これらは必要に応じて交換可能な依存先、デモ用UI、または将来のアダプターとして利用する。画像のデコード、動画の再生・一時停止・シーク・音声はブラウザと既存のメディアAPIへ委ねる。

## 4. 調査結果と作る価値

### 4.1 関連技術

- [WICG HTML-in-Canvas](https://github.com/WICG/html-in-canvas) は、Canvas配下のHTMLを2D Canvas、WebGL、WebGPUへ描画し、HTML側を描画位置へ整列させてブラウザ本来のhit testingを利用する提案である。2026年7月時点ではChromiumの実験機能であり、全利用者にそのまま提供できる段階ではない。
- [Three.js `HTMLTexture`](https://threejs.org/docs/pages/HTMLTexture.html) はHTML要素をTextureとして扱い、親Canvasのpaintイベントから更新する。r185にはHTML-in-Canvas API変更への追従が含まれる。
- Three.jsの`InteractionManager`は、HTML要素をMesh前面へCSS `matrix3d`で整列させ、ブラウザ本来のDOMイベントを利用する。ただし標準実装は主に単一平面を想定する。
- [Three.js `HTMLMesh`](https://threejs.org/docs/pages/HTMLMesh.html) はDOMをCanvasTextureへ変換できるが、独自の簡易HTML描画であるため、一般的なCSSやフォーム再現には限界がある。
- [`three-html-render`](https://github.com/repalash/three-html-render) はHTML-in-Canvasのpolyfill、Three.js互換の`HTMLTexture`、平面向けとRaycast向けのInteractionManagerを提供する。SVG `foreignObject`によるstableブラウザ向けフォールバックや、曲面上の操作にも対応している。
- [Drei `Html`](https://drei.docs.pmnd.rs/misc/html) と[Babylon.js HtmlMesh](https://doc.babylonjs.com/addons/htmlMesh)は、CSS変形や深度マスクを使ってDOMと3Dを重ねる方式が中心で、実際のMeshテクスチャとは性質が異なる。通常のDOM操作には強い一方、WebXRや任意のMesh変形では制約がある。
- [Canvas UI](https://canvasui.dev/docs) は、HTML-in-Canvasを利用してライブHTMLへWebGLエフェクトを重ねるクリエイティブコンポーネント集である。主眼はページ表現とエフェクトであり、3Dモデルの任意Meshを操作可能なUIサーフェスとして管理することではない。
- `three-mesh-ui`や`@react-three/uikit`などは3DネイティブのUI部品を構築する。WebXRとの相性は良いが、既存のHTML／CSS／Reactコンポーネントをそのまま利用する方式ではない。
- Three.jsには静止画やCanvas、動画をTextureとして扱う既存経路がある。単独メディアではこれらを利用し、HTMLレイアウトとの合成が必要な場合だけHTML描画バックエンドを利用することで、用途に応じた更新コストを選べる。

### 4.2 独自価値

HTMLのラスタライズ技術自体は再実装しない。本プロトタイプの価値は、既存の描画プリミティブを利用して次の問題を一つの小さなAPI境界で扱うことに置く。

- HTMLElementと任意のThree.js Meshを関連付ける
- UV座標とDOM座標の関係を明示的に扱う
- UI Mesh以外の遮蔽物を含む、シーン全体の最前面判定を行う
- 複数サーフェス間でhover、focus、pointer、wheelの送り先を切り替える
- DOM、Texture、Material、Geometry、イベントリスナーの所有権と破棄順序を管理する
- native API、polyfill、将来の別レンダラーを差し替えられる境界を保つ
- 画像、動画、HTML合成で異なる描画更新方式を使いながら、Mesh管理と遮蔽処理を共通化する

## 5. 採用方針

### 5.1 ハイブリッド・サーフェス層

描画にはThree.jsのTexture機構と`three-html-render`のstableブラウザ向けpolyfillを利用する。ライブラリはその上に、サーフェス登録と入力ルーティングを提供する。

プロトタイプではThree.js r185を開発・検証対象とするが、r185固有クラスをコア全体へ漏らさない。HTML Texture作成、Materialへの適用、描画更新は小さなアダプター関数またはインターフェースの背後へ閉じ込める。

native HTML-in-Canvasが利用可能な場合はnative経路を優先し、利用できない場合はpolyfillをインストールする。どちらの経路でも、サーフェス管理側のAPIは変えない。

### 5.2 最初の縦切り

最初に以下を一連で完成させる。

1. ReactDOMで操作パネルをHTMLElementへマウントする
2. そのHTMLElementからHTML Textureを作る
3. Textureをモニター形状のMeshへ関連付ける
4. PointerEventをシーン全体へRaycastする
5. 最前面ヒットが登録済みUI Meshの場合だけ、UVをDOM座標へ変換して操作を送る
6. ボタン、入力欄、スクロールを実際に操作する
7. サーフェスを破棄し、DOMとGPUリソースとイベントリスナーを解放する

CapabilityReport、詳細な診断UI、React Three Fiberアダプター、画像／動画向けの最適化アダプターなどは、この縦切りが動いた後に追加する。

### 5.3 画像・動画の描画経路

公開リリースに向けて、画像と動画は用途に応じて次の経路を選べるようにする。

1. **単独の画像**  
   `HTMLImageElement`などから通常の画像Textureを作り、HTMLラスタライズを経由せずMeshへ適用する。画像の内容が変わった場合だけ更新する。

2. **単独の動画**  
   `HTMLVideoElement`をブラウザ側で再生し、動画向けTextureとしてMeshへ適用する。再生、停止、シーク、音声、デコードはvideo要素が担当し、ライブラリは表示更新とサーフェス管理を担当する。

3. **HTMLとメディアの合成**  
   画像または動画を、テキスト、ボタン、フォーム、字幕、再生コントロールなどと同じDOMレイアウトに含めたい場合は、HTML-in-Canvasまたはpolyfill経路を利用する。

どの経路も同じTexture handle契約へ収束させ、サーフェス管理側が画像、動画、HTMLの具体的な描画方式を判定しない構成とする。単独メディアで十分な場合に、HTML描画や毎フレームのCanvasコピーを強制しない。

## 6. 仮の構成

責務名は実装前の仮称であり、各ファイルが小さいままであれば統合してよい。逆に、入力状態や所有権が複雑になった場合のみ分割する。

### 6.1 サーフェス

サーフェスは最低限、次の情報を持つ。

- 一意なID
- sourceとなるHTMLElement。初期実装では一般HTMLを対象とし、後から`HTMLImageElement`と`HTMLVideoElement`用の描画アダプターを追加できること
- UIまたはメディアを表示するMesh
- HTMLまたはメディア由来のTexture
- Textureを適用するMaterialとmapの指定
- UVからDOM座標への変換設定
- Texture、Material、Geometry、DOM／メディア要素を誰が所有し、誰が破棄するか

想定APIは次の程度から始める。

```ts
const surface = manager.add({
  element,
  mesh,
  material: mesh.material,
  mapProperty: 'map',
  transformUv: (uv, texture) => texture.transformUv(uv),
});

surface.invalidate();
surface.dispose();
```

Mesh生成を強制しない。利用者が用意した既存Meshへ関連付けられることを基本とし、デモ向けの便利関数はコア外へ置く。

### 6.2 Texture作成境界

Texture作成は次のような小さな契約に閉じ込める。

```ts
type HtmlTextureHandle = {
  texture: THREE.Texture;
  invalidate(): void;
  dispose(): void;
};

type HtmlTextureBackend = {
  readonly kind: 'native' | 'polyfill';
  mount(element: HTMLElement): HtmlTextureHandle;
  requestPaint(): void;
};
```

実際の実装では`three-html-render`とThree.jsの型に合わせて簡略化してよい。重要なのは、サーフェス管理と入力ルーティングがHTML-in-Canvasの具体的なAPIシグネチャを知らないことである。

プロトタイプではHTMLElement向けのbackendから始める。公開リリースまでには、静止画は変更時のみ、動画は再生フレームに応じて、HTMLはpaintまたはinvalidateに応じて更新できるよう、描画更新の方針をTexture handle側へ閉じ込める。公開型の詳細は実測後に決めるが、管理層へメディア固有の更新分岐を持ち込まない。

### 6.3 メディアソースへの拡張境界

画像・動画対応では、次の責務を分離する。

- **視覚ソース**：Meshへ適用するTextureを提供する
- **更新方針**：静止画の変更、動画フレーム、HTMLの再描画を通知する
- **操作対象**：DOM由来のfocus、selection、wheelを利用する要素が存在するかを示す
- **所有権**：Texture、DOM要素、video要素、イベントリスナーのうち何をサーフェスが破棄するかを示す

単独の画像や動画は表示専用サーフェスとして扱える。クリックなどが必要な場合は、DOM固有のイベント転送を必須にせず、同じRaycast／UV結果を利用者定義のハンドラーへ渡せる余地を残す。ブラウザ標準のvideo controlsを3D表面でそのまま操作したい場合は、HTML合成経路または別のHTML操作パネルを利用する。

### 6.4 入力ルーティング

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

表示専用の画像・動画サーフェスではDOMイベント転送を省略できるが、Raycast、最前面判定、UV算出はHTML Surfaceと同じ処理を利用できるようにする。

### 6.5 複数サーフェス

管理単位は一つのrenderer、camera、sceneに接続し、複数サーフェスを登録できるようにする。

同じPointerに対してアクティブになるDOMサーフェスは一つだけとし、それ以外のDOMは画面外へ退避する。初期プロトタイプは各イベント時点の最前面hitを再評価する。Pointer capture中に開始時のサーフェスを維持し、pointerupまたはpointercancelで解除する処理は次段階へ送る。

複数renderer、複数camera、XR controller rayは最初の縦切りに含めない。ただし、入力ルーティングの内部を「スクリーン座標からRayを作る処理」と「Rayからサーフェスを選ぶ処理」に分けられる形にし、将来XR Rayを渡せる余地を残す。

### 6.6 Reactの扱い

コアはReactを依存関係に持たない。デモ側で次のようにReactDOMを通常のHTMLElementへマウントし、その要素をVanilla APIへ渡す。

```tsx
const element = document.createElement('div');
const surface = manager.add({ element, mesh });

const root = createRoot(element);
root.render(<ControlPanel />);
```

破棄時はReact rootをunmountした後、サーフェスを入力管理とDOMホストから外す。

## 7. デモ

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

公開リリース候補版では、応用例として次を追加する。

- 静止画を任意Meshへ貼り、UV変換、アスペクト比、遮蔽を確認する例
- 動画を3Dモニターへ表示し、再生中だけ映像が更新される例
- 別のHTML Surfaceから動画の再生、一時停止、シークを操作する例
- 画像または動画をHTMLレイアウト内のテキストやボタンと合成する例
- 各例がnative media texture、native HTML-in-Canvas、polyfillのどの経路を利用しているかを示す診断表示

## 8. エラー処理とフォールバック

実装済み:

- WebGLを作成できない場合は、3Dデモを開始せず理由をDOMへ表示する
- HTML-in-Canvasが利用できない場合はpolyfill経路へ移る
- Raycast結果にUVがないMeshは操作対象外とする
- Texture生成の非同期更新中は直前フレームのTextureを維持する
- サーフェス破棄は複数回呼んでも安全にする

次段階:

- polyfill初期化にも失敗した場合は、HTML要素を通常の2D DOMとして表示し、3D操作が利用できないことを示す
- UVがないMeshと0サイズのHTMLElementへ、開発時に一度だけ分かりやすい警告を出す
- 画像の読み込みまたはデコードに失敗した場合は、直前のTextureまたは診断用プレースホルダーを維持し、原因を通知する
- 動画が未読み込み、再生終了、またはautoplay制限で停止している場合でも、レンダーループを失敗させない。ライブラリが利用者の許可なく再生を強制しない
- クロスオリジン、DRM、ブラウザ制限により利用できないメディア経路は、別経路へ暗黙に偽装せず診断情報として公開する
- 外部から渡されたvideo要素は、サーフェスの破棄だけで自動停止またはsrc破棄しない。所有権を持つ場合だけ関連リソースを解放する

## 9. 検証方針

新規テストは、3D入力の基礎となる共有ロジックに限定して追加する。見た目そのものはブラウザ操作で確認する。

### 9.1 自動テスト

- UVからDOM座標への変換
- Texture transformを含むUV変換
- 複数交差から最前面サーフェスまたは遮蔽物を選ぶ処理
- Three.js r185とpolyfill 0.1.2のupload signature互換処理

### 9.2 ブラウザ検証

stable版Chromiumで次を操作する。

- ボタンをクリックするとReact状態が更新され、Textureにも反映される
- 入力欄へフォーカスして文字を入力できる
- Wheelでスクロール領域が動く
- OrbitControlsとUI操作を切り替えられる
- 遮蔽物の背後ではクリックできず、手前へ出ると再び操作できる
- 複数サーフェス間でhoverとfocusが誤送信されない

公開リリース前には、追加で次を確認する。

- 静止画が不要な毎フレーム更新なしで表示される
- 動画が再生中に更新され、一時停止中は不要な更新を抑えられる
- 画像と動画でもHTML Surfaceと同じUV変換、遮蔽、Material適用を利用できる
- HTML操作パネルからvideo要素の再生、一時停止、シークを行える
- 画像または動画を含むHTML合成経路が、対応バックエンドで正しく更新される
- 画像／動画Surfaceの破棄後に更新処理、GPUリソース、イベントリスナーが残らない
- CORS、autoplay、DRMなどの制約が診断情報と文書に反映される

可能であればFirefoxでもpolyfill経路の起動を確認する。WebXRは今回の完了条件に含めない。

## 10. 現時点で受け入れる制約

- polyfill経路はSVG `foreignObject`による再描画とGPU uploadを含み、native経路より高コストである
- CSS、form controlの見た目、textarea内部スクロール、contenteditable、`:visited`などはpolyfillの制約を受ける
- クロスオリジン画像と動画はCORS設定の影響を受け、HTML合成経路ではTexture化できない場合がある
- iframe、DRM動画、保護されたメディアを完全にTexture化できるとは限らない
- 単独動画の直接Texture経路と、video要素を含むHTML合成経路では、利用可能なブラウザ機能、性能、表示結果が一致しない場合がある
- ブラウザのautoplay、音声出力、ユーザー操作要件は回避せず、そのまま制約として扱う
- UVが重複するMeshやUVを持たないGeometryは、追加のマッピング情報なしでは正しく操作できない
- 極端に歪んだ三角形や高頻度に変形するSkinnedMeshでは、DOM overlayとTextureの見え方に差が出る可能性がある
- ブラウザのアクセシビリティツリーには実DOMを残せるが、3D上の視覚位置と読み上げ順序が自然に一致する保証はない
- WebXRコントローラー、ハンドトラッキング、ソフトウェアキーボードは将来対応とする

## 11. 実装後に判断する事項

最初の縦切りを動かした後、実測とコードの複雑さを見て次を判断する。

- `HtmlSurface`をクラスにするか、単純なrecordとdispose関数にするか
- Texture factoryを公開インターフェースにするか、内部関数に留めるか
- 入力ルーターと複数サーフェス管理を同じクラスに置くか分離するか
- `CapabilityReport`を公開APIにするか、デモの診断値に留めるか
- DOMをポインター位置へ移動する方式を維持するか、特定イベントだけUVから再送する方式を併用するか
- React Three Fiber用hook／componentを別packageにするか、例だけ提供するか
- 画像／動画アダプターをコアへ含めるか、任意の追加packageまたは公式recipeとして提供するか
- 静止画、動画、HTMLの更新方針を共通のTexture handleで十分に表現できるか
- video要素の再生状態とリソース所有権をライブラリがどこまで管理するか
- 表示専用メディアSurface向けのRaycastイベントを公開APIへ含めるか

### 11.1 プロトタイプでの判断結果

- `HtmlSurface`は独立classにせず、managerが所有するrecordと小さな公開handleにした
- Texture生成は`HtmlTextureBackend`として差し替え可能にし、Surface管理層からr185とpolyfillの詳細を隔離した
- 入力ルーティングと複数Surface管理は、状態量がまだ小さいため`HtmlSurfaceManager`へまとめた
- `CapabilityReport`は追加せず、backend種別とhit情報をデモHUDだけに表示した
- DOM整列方式でbutton、input、scrollを操作できたため維持した。ただしpointer capture、drag、IME、selectionは未完である
- Reactは専用adapterを作らず、通常のReactDOM rootが生成するHTMLElementをVanilla APIへ渡す例に留めた

## 12. プロトタイプの完了条件

- `npm install`と`npm run dev`で第三者がデモを起動できる
- `npm run build`と自動テストが成功する
- stable ChromiumでReact UIとVanilla UIを3D表面から操作できる
- 遮蔽物が表示と入力の両方を遮る
- READMEに概要、実現できたこと、制約、既存技術との差、今後の機能、実行方法、使用例を日本語で記載する
- private GitHubリポジトリへソースと文書が保存される

画像／動画アダプターの完成は最初の縦切りの完了条件には含めない。ただし、プロトタイプのTexture作成境界とサーフェス管理が、後からメディア対応を追加する際の作り直しを要求しないことをレビューする。

## 13. 公開リリースまでのメディア拡張条件

- 単独の静止画と単独の動画を、HTML Surfaceと同じMesh関連付け、Material適用、UV変換、遮蔽、ライフサイクル管理の上で扱える
- 単独メディアでは、適切なThree.js Texture経路を利用し、不要なHTMLラスタライズまたはCanvasへの毎フレームコピーを強制しない
- HTMLと画像／動画を合成する経路も残し、テキスト、フォーム、再生コントロールと組み合わせられる
- 静止画、動画、HTMLの描画経路をアダプター境界で切り替えられ、サーフェス管理側の公開APIを用途ごとに分岐させない
- 画像例、動画例、HTMLとメディアの合成例を実行可能なデモまたは公式サンプルとして提供する
- 読み込み失敗、CORS、autoplay、DRM、所有権、破棄、性能上の差をREADMEへ記載する
- メディア対応後も、プロトタイプで成立したHTML入力、最前面判定、複数Surface管理を壊さない
