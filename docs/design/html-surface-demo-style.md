# HTML Surfaceデモ・ビジュアル基準

参照画像: `docs/design/html-surface-demo-concept.png`

## 画面構成

- full-bleedのThree.js Canvasを背景にする
- 左端に幅約180pxの診断レールを固定する
- 中央の大型モニターを主役にする
- 右側に小型のVanilla Surfaceを傾けて置く
- 中央画面の一部を横切る立方体で遮蔽を示す
- マーケティング用ヘッダーやカードグリッドは追加しない

## 許可する表示文言

- `HTML SURFACE LAB`
- `Backend`
- `polyfill`または`native`
- `Hit`
- `UV`
- `DOM`
- `Run action`
- `Input signal`
- `Activity`
- `Surface status`
- `Vanilla surface`
- `Move occluder`
- 操作結果として生成される時刻、回数、入力値

## トークン

- 背景: `#080b0f`
- 金属: `#151a1d`
- UI面: `#0d1518`
- UI面の明部: `#121d20`
- 本文: `#f0eee8`
- muted: `#8b9a9f`
- border: `#304044`
- primary: `#65e6d4`
- primary dark: `#143d3a`
- amber: `#e6a85f`
- danger: `#f07a68`
- radius: UI 8px、モニター外枠は小さな面取り
- shadow: 黒を基調にし、cyan glowはfocusだけに限定する

## タイポグラフィ

- `ui-monospace, SFMono-Regular, Consolas, monospace`
- モニター見出し: 26px / 700
- UI見出し: 13px / 650 / 0.04em
- 本文とcontrol: 13px / 450
- 診断ラベル: 11px / uppercase
- 診断値: 14px / cyan

## Component family

- instrument button: cyan背景、黒文字、角丸4px
- field: 暗い塗り、1px border、cyan focus ring
- log: 開放的な縦リスト。各行をカード化しない
- status row: labelとvalueの2列
- secondary surface: 同じトークンを使う小型版
- icon: 専用iconは使わず、小さなCSSのstatus dotだけを許可する

## Motion

- 遮蔽物だけをゆっくり左右へ往復させる
- OrbitControlsはdampingを使う
- `prefers-reduced-motion`時は遮蔽物を静止させる

## 最終比較

一致させた要素:

- 左の診断レール、中央の大型モニター、右の小型Surface、前面の遮蔽物という情報階層
- graphite、off-white、cyanを中心とする配色
- モノスペースの計器的UI、cyanのprimary action、開放的なactivity log
- 3D Meshのperspectiveと遮蔽へHTML Textureが自然に参加する見え方

プロトタイプとして意図的に簡略化した要素:

- 工業製品レベルのbevel、ねじ、handle、床反射は、入力の縦切り検証に不要なため省略
- FPS、triangle数、UVグラフはCapabilityReportを先送りした方針に合わせて省略
- 右Surfaceはscene統計ではなく、2つ目のVanilla HTMLElementと遮蔽物制御を示す

最終ブラウザ表示は`docs/design/html-surface-demo-browser.png`、遮蔽入力検証は`docs/design/html-surface-demo-occlusion.png`を参照する。
