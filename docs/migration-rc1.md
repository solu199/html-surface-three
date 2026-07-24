# 0.0.0プロトタイプから0.1.0-rc.1への移行

基本形の`new HtmlSurfaceManager()`、`manager.add()`、`manager.update()`、`surface.invalidate()`、`surface.dispose()`は維持しています。RC1では競合、所有権、Backend選択を明確化しました。

## stable優先のBackend選択

```ts
const manager = new HtmlSurfaceManager({
  renderer,
  camera,
  scene,
  backend: 'auto',
});
```

`auto`はnative機能を検出してもpolyfillを選びます。実験native経路を試す場合だけ`backend: 'native'`を明示してください。利用できない場合は`HtmlSurfaceError`の`backend-unavailable`になります。

## 有効状態と初期化

```ts
const surface = manager.add({
  element,
  mesh,
  enabled: false,
});

await surface.ready;
surface.setEnabled(true);
```

`setEnabled(false)`はDOM／React状態を保持したまま入力候補から外します。破棄済みSurfaceへの`setEnabled()`は`surface-disposed`をthrowします。

## Material Binding

`materialIndex`と`mapProperty`が明示的なBinding契約になりました。

```ts
manager.add({
  element,
  mesh,
  materialIndex: 1,
  mapProperty: 'emissiveMap',
});
```

同じMaterialの同じプロパティへ別Surfaceを重ねると`material-binding-conflict`になります。プロトタイプのような暗黙の上書きは行いません。

## 型付きエラー

文字列messageではなく`code`で分岐してください。

```ts
try {
  manager.add(options);
} catch (error) {
  if (
    error instanceof HtmlSurfaceError
    && error.code === 'material-binding-conflict'
  ) {
    // 利用者へ設定競合を表示する
  }
}
```

code一覧は[APIリファレンス](api.md#htmlsurfaceerror)を参照してください。

## 所有権とdispose

MaterialとGeometryは既定で利用者所有です。ライブラリに破棄させる場合だけ`disposeMaterial`／`disposeGeometry`を`true`にします。

Surface破棄時、対象MaterialがまだSurfaceのTextureを参照していれば元のmapを復元します。利用者が後から別Textureへ変えた場合は、その変更を保持します。React rootは`surface.dispose()`より前に利用者が`unmount()`してください。

## Backend SPI

Backend factoryと契約はroot exportから除外し、次のサブパスへ移動しました。

```ts
import {
  createHtmlTextureBackend,
  type HtmlTextureBackend,
} from 'html-surface-three/experimental';
```

このAPIはRC間で変更される可能性があります。通常の利用では`HtmlSurfaceManager`の文字列`backend`指定を使ってください。

## CapabilityReport

`manager.getCapabilityReport()`で要求Backend、実際のBackend、pointer capture、touchなどを確認できます。desktopの`touch-unavailable`は警告であり、Surfaceの初期化失敗ではありません。
