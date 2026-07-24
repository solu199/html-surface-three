# HTML Surface関連技術調査

調査日: 2026-07-24

## 結論

HTMLをTextureへ変換する技術自体には既存の選択肢がある。一方で、HTMLElementと任意のThree.js Meshを関連付け、Materialへの適用、UV／DOM座標変換、シーン全体の遮蔽を含む入力ルーティング、複数Surface、破棄までを同じ単位で扱う層には、まだ実験する価値がある。

本プロトタイプでは、この単位を **HTML Surface** と呼ぶ。HTML-in-Canvas、Three.js `HTMLTexture`、`three-html-render`はHTML Surfaceの描画バックエンドまたは低レベル基盤であり、ライブラリの主語にはしない。

## 技術比較

| 技術 | 得意なこと | HTML Surfaceから見た位置付け |
| --- | --- | --- |
| [WICG HTML-in-Canvas](https://github.com/WICG/html-in-canvas) | Canvas配下のHTMLを2D Canvas、WebGL、WebGPUへ渡し、ブラウザのレイアウトやhit testingを活用する実験API | native描画バックエンド候補。一般利用できない環境があるため、現時点ではこれだけに依存しない |
| [Three.js HTMLTexture](https://threejs.org/docs/pages/HTMLTexture.html) | HTMLElementをThree.js Textureとしてアップロードする | Texture生成の低レベル基盤。Mesh関連付け、遮蔽、複数Surface管理は上位層の責務 |
| [Three.js HTMLMesh](https://threejs.org/docs/pages/HTMLMesh.html) | HTMLを簡易的にCanvasTexture化したMeshを作る | 利便性は高いが、対応CSSとイベント変換に限界がある。任意Meshを主語にする本案とは責務が異なる |
| [three-html-render](https://github.com/repalash/three-html-render) | HTML-in-Canvas polyfill、HTML Texture、Raycast向け基盤を提供する | stableブラウザ向け描画フォールバック。本プロトタイプではpolyfillだけを交換可能なbackend内に閉じ込める |
| [Canvas UI](https://canvasui.dev/docs) | HTML-in-Canvasを使い、ライブHTMLへWebGL表現を重ねる | ページ表現・エフェクトが主眼。任意の3D MeshとUIをSurfaceとして管理する層とは異なる |
| [Drei Html](https://drei.docs.pmnd.rs/misc/html) | React Three FiberでDOMを3D位置へ重ねる | DOMオーバーレイ。通常のDOM操作に強い一方、Textureとして任意Meshへ変形・投影する方式ではない |
| [Babylon.js HtmlMesh](https://doc.babylonjs.com/addons/htmlMesh) | DOMをCSS 3Dでシーンへ配置し、遮蔽用Meshと組み合わせる | DOM／CSS変形が中心。Texture化されたMesh Surfaceとは別方式 |
| three-mesh-ui / React Three Fiber向け3D UI | 3DネイティブなレイアウトとXR向けUI | HTML/CSS資産を再利用する方式ではない。将来の代替backendまたは併用候補 |

## 実装で判明した制約

### HTML-in-Canvasはまだ一枚岩ではない

Three.js r185は、`texElementImage2D.length === 3`をChrome 150以降の3引数形式と解釈する。一方、npm版`three-html-render` 0.1.2のpolyfillは、旧6引数形式をrest parameterで実装しているため、関数の`length`が偶然3になる。この組み合わせはそのままでは誤判定される。

プロトタイプではbackend内に小さな互換アダプタを置き、polyfill時だけ旧6引数形式であることをThree.jsへ伝えている。これはr185固有の詳細をSurface管理層へ漏らさないための境界でもある。

また、npm版0.1.2の公開exportはREADMEのmain branchより限定されている。そのため本実装はThree.jsの`HTMLTexture`を使用し、`three-html-render`からはpolyfillだけを利用する。

### stableブラウザではpolyfillの描画忠実度が上限になる

polyfillはSVG `foreignObject`を含むラスタライズ経路を使う。CORS制約のある画像、複雑なCSS、動画、ブラウザ固有control、非常に頻繁な更新は、native HTML-in-Canvasと同じ忠実度や性能を保証できない。

### ブラウザ操作性の維持にはDOMを一時整列する必要がある

Textureだけでは、入力欄のIME、selection、focus、スクロール、アクセシビリティなどのブラウザ機能を直接受け取れない。本プロトタイプはRaycastのUVからDOM座標を求め、対象DOMを一時的にpointer位置へ整列させて、ブラウザのhit testingを再利用する。遮蔽物が前面に来た場合はDOMを退避する。

## 差別化の中心

- 任意の既存MeshとHTMLElementを結び付ける
- Materialとmap propertyを選び、元の値を復元する
- Texture transformまたは利用者指定のUV変換を入力にも反映する
- UI Mesh以外も含むscene全体の最前面hitから入力先を決める
- 複数Surfaceのうち、同時に一つだけをDOM hit testingへ整列する
- DOM、Texture、イベント、Material／Geometryの所有権を明示して破棄する
- native、polyfill、将来の別rendererを差し替えられるbackend境界を保つ

## 作る価値の判定

現段階の判定は「研究用ライブラリとして作る価値がある」。理由は、描画primitiveの再発明を避けながら、実アプリが必要とする関連付けと入力の統合を検証できたためである。

ただし、公開パッケージとして安定化する前に、複数ブラウザ、複数Material／UV channel、pointer capture、IME、タッチ、WebXR controller ray、大量Surface時の性能を追加検証する必要がある。
