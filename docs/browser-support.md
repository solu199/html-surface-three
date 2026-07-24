# ブラウザ互換性

`0.1.0-rc.1`はstableブラウザを優先し、保証範囲を段階化しています。標準経路はpolyfill Backendです。

## 段階保証

| Tier | 対象 | 自動検証 |
|---|---|---|
| Tier 1 | stable Chrome | moving／rotated React Surface、navigation、button、text input、keyboard、checkbox、range drag、scroll、composition、複数Surface、遮蔽、capture、touch |
| Tier 1 | stable Edge | Chromeと同じ全シナリオ |
| Tier 2 | Playwright Firefox | 起動、React Surface表示、button、input、scrollのsmoke |
| Tier 2 | Playwright WebKit | Firefoxと同じsmoke |
| Experimental | native HTML-in-Canvas対応環境 | 検出と明示選択のみ。互換性保証外 |

検証基準日は2026-07-24です。Tier 1はWindows上のstable channelを使い、Tier 2はPlaywrightが管理するbrowser buildを使います。

Playwright WebKitは実Safariそのものではありません。Safariの完全保証を意味しません。

## 操作ごとの範囲

- pointer／mouse: Tier 1でclick、hover、drag、capture、遮蔽を検証
- touch: hoverのない最初の`pointerdown`からactivationまでをTier 1で検証
- keyboard／focus: 実DOMへfocusし、ブラウザの配送を利用
- IME: composition eventから値とTexture更新までをTier 1で検証。ただし全OS・全IMEの変換候補UIは保証しない
- wheel／scroll: nested scroll対象の選択とSurface上のscrollを検証
- form controls: button、text input、checkbox、rangeを検証

## 実Safariの手動確認項目

1. React SurfaceとVanilla Surfaceが表示される
2. buttonのclickが一度だけ発火する
3. text inputへfocusし、日本語入力を確定できる
4. scroll領域がwheel／trackpadで動く
5. range inputをdragし、Surface外でpointerを離しても終了する
6. touch端末で最初のtapが反応する
7. 遮蔽物の背後にあるUIが操作されない
8. consoleに未処理例外や連続警告が出ない

結果に差がある場合は、OS、Safari version、入力装置、GPU、使用BackendをIssueへ添えてください。

## CapabilityReportの読み方

`getCapabilityReport()`は「APIとして扱える能力」と「その端末で検出した装置」を区別します。たとえばdesktopで`touch-unavailable`が出ても、touch routingの実装が無効という意味ではありません。native経路は`nativeAvailable: true`でも、`backend: 'native'`を明示しない限り選択されません。
