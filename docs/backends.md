# Texture Backend

HTML Surfaceは、HTMLElementの描画結果をTextureへ変換する処理だけをBackendへ委譲します。任意Meshとの関連付け、Material適用、UV／DOM座標変換、遮蔽、入力、複数Surface、所有権は`HtmlSurfaceManager`側の責務です。

## RC1の選択肢

| 指定 | 選択 | 安定性 |
|---|---|---|
| `auto` | 常に`polyfill` | RC1の既定。stableブラウザ優先 |
| `polyfill` | `three-html-render`を使う | Tier 1／2の検証対象 |
| `native` | native HTML-in-Canvasが検出できる場合のみ | experimental。未検出なら`backend-unavailable` |

`auto`はnative機能が存在してもpolyfillを選びます。ブラウザの実験機能が突然有効になって挙動が変わることを避けるためです。

## polyfill Backend

`three-html-render`のpolyfillとThree.js `HTMLTexture`を低レベル基盤として使います。DOM mutation、`input`、`change`、`scroll`、`compositionend`を監視し、Texture更新を要求します。Three.jsとpolyfill間のupload signature差はBackend内部の互換Adapterで吸収します。

この経路はSVG `foreignObject`を介するため、CSS、form control、font、CORSメディアの見え方はブラウザ差分を受けます。

## native Backend

Canvasの`requestPaint()`とWebGL contextの`texElementImage2D`を検出し、利用者が`backend: 'native'`を明示した場合だけ選びます。RC1では互換性保証外です。`CapabilityReport`に`native-backend-experimental`警告が入ります。

## experimentalエントリーポイント

Backend SPIとfactoryは安定Facadeから分離されています。

```ts
import {
  createHtmlTextureBackend,
  detectNativeHtmlInCanvas,
  selectBackendKind,
  type HtmlTextureBackend,
  type HtmlTextureHandle,
} from 'html-surface-three/experimental';
```

`HtmlTextureBackend`の現在の契約:

```ts
type HtmlTextureBackend = {
  readonly kind: 'native' | 'polyfill';
  readonly nativeAvailable: boolean;
  mount(element: HTMLElement): HtmlTextureHandle;
  requestPaint(): void;
};
```

このサブパスはsemver上の安定保証対象外です。custom Backendを製品コードへ組み込む場合は、RC更新時に契約を再確認してください。

## 将来の境界

- React Three Fiber: Manager生成と`update()`／`dispose()`をhookで接続する薄いAdapter
- WebXR: controller／hand rayの交差結果を既存の入力解決へ渡すAdapter
- 画像／動画: 単独メディアではThree.jsのTextureを直接作り、HTMLとの合成が必要な場合だけHTML Backendを使う
- 別描画方式: 3DネイティブUIやサーバー側rasterizeをSurface管理から独立して差し替える

いずれもBackendへ遮蔽やDOMイベント配送を持ち込まず、HTML Surfaceの責務境界を維持します。
