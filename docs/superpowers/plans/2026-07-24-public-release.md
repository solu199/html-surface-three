# HTML Surface Three 公開リリース実装計画

> **実装時の注意:** 各Taskを順番に実行し、検証に失敗した場合は次の不可逆操作へ進まない。

**Goal:** `html-surface-three@0.1.0-rc.1`を、英語中心の公開リポジトリ、操作可能なGitHub Pages、npmの`next` dist-tag、保護されたGit tag、GitHub Prereleaseを備えた状態で公開する。

**Architecture:** ライブラリ本体の責務境界は変更しない。公開作業は、package metadata、README／community files、Pages／publish workflow、GitHub repository settings、npm Trusted Publishingを外側へ追加する。既存のReact／Vanilla統合デモを公開用の実行可能な仕様書として再利用する。

**Tech Stack:** TypeScript、Three.js、Vite、Vitest、Playwright、GitHub Actions、GitHub Pages、npm Trusted Publishing、GitHub CLI/API。

**設計書:** `docs/superpowers/specs/2026-07-24-public-release-design.md`

---

## Task 1: 公開package metadataとリリース判定ロジック

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`（npmがtop-level metadataを更新した場合のみ）
- Create: `scripts/release-info.mjs`
- Create: `tests/release-info.test.ts`
- Modify: `scripts/verify-package.mjs`

### Step 1: リリース判定テストを先に追加する

新規テストが必要な理由: tag、package version、npm dist-tagの誤対応は公開済みversionを修正できない高リスク変更なので、純粋関数として回帰を固定する必要がある。

`tests/release-info.test.ts`へ、少なくとも次を追加する。

- `v0.1.0-rc.1`と`0.1.0-rc.1`から`next`を返す
- `v0.1.0`と`0.1.0`から`latest`を返す
- tagとpackage versionが不一致なら失敗する
- `v`で始まらないrefを拒否する
- 不正なsemverを拒否する

Run:

```powershell
npx vitest run tests/release-info.test.ts
```

Expected: `scripts/release-info.mjs`が未実装のためFAIL。

### Step 2: 最小のリリース判定ロジックを実装する

`scripts/release-info.mjs`は、外部依存を増やさず次を返す。

```js
{
  version: '0.1.0-rc.1',
  tag: 'next',
  packageSpec: 'html-surface-three@0.1.0-rc.1'
}
```

CLI実行時は`GITHUB_OUTPUT`へ`version`、`tag`、`package_spec`を書き出せるようにする。tokenやregistry credentialは読み取らない。

Run:

```powershell
npx vitest run tests/release-info.test.ts
```

Expected: PASS。

### Step 3: package metadataを公開用に整える

`package.json`を次の方針で更新する。

- descriptionを英語化
- homepageをGitHub Pagesへ変更
- keywordsへ`canvas`と`3d-ui`を追加
- `publishConfig.access`を`public`に設定
- `build:pages`を`vite build --base=/html-surface-three/`として追加
- `release:info`をrelease scriptへ接続
- Reactをruntime dependencyに追加しない
- `files`の限定を維持

`scripts/verify-package.mjs`へ、tarballのpackage metadataと許可ファイルを確認する検査を追加する。`docs/superpowers`、`dist-demo`、`artifacts`、認証ファイルが含まれた場合は失敗させる。

Run:

```powershell
npm install --package-lock-only
npm run typecheck
npm test
npm run verify:package
```

Expected: 全てPASS。package tarballには`dist`、`README.md`、`LICENSE`、`CHANGELOG.md`とpackage metadataだけが含まれる。

### Step 4: コミット

```powershell
git add package.json package-lock.json scripts/release-info.mjs scripts/verify-package.mjs tests/release-info.test.ts
git commit -m "build: 公開パッケージのリリース判定を追加"
```

---

## Task 2: Pages・Trusted Publishing・CodeQL workflow

**Files:**

- Create: `.github/workflows/pages.yml`
- Create: `.github/workflows/publish.yml`
- Create: `.github/workflows/codeql.yml`
- Modify: `.github/workflows/ci.yml`（必要最小限のtimeout／concurrencyのみ）

### Step 1: Pages workflowを追加する

`.github/workflows/pages.yml`は`main`へのpushと`workflow_dispatch`で実行する。

権限:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

処理:

1. checkout
2. Node 22 setup
3. `npm ci`
4. `npm run build:pages`
5. `dist-demo`をPages artifactとしてupload
6. `actions/deploy-pages`でdeploy

`concurrency`を設定し、古い未完了deployをcancelする。

### Step 2: publish workflowを追加する

`.github/workflows/publish.yml`は`v*`tagへのpushと`workflow_dispatch`を契機にする。

権限:

```yaml
permissions:
  contents: read
  id-token: write
```

処理:

1. tag refであることを確認
2. checkout
3. Node 22とnpm 11.17系をsetup
4. `npm ci`
5. `scripts/release-info.mjs`でtagとpackage versionを照合
6. `npm run verify`
7. registryで同versionの存在を確認
8. 存在済みならnoticeを出して安全にskip
9. 未公開なら`npm publish --provenance --access public --tag <next|latest>`

workflowに`NPM_TOKEN`参照を追加しない。

### Step 3: CodeQL workflowを追加する

JavaScript／TypeScriptだけを対象にし、`pull_request`、`main`へのpush、週次scheduleで実行する。権限は`security-events: write`などCodeQLに必要な範囲だけを明示する。

### Step 4: workflow構文とローカルbuildを検証する

Run:

```powershell
npm run build:pages
Select-String -Path dist-demo\index.html -Pattern "/html-surface-three/"
npx vitest run tests/release-info.test.ts
git diff --check
```

Expected:

- `dist-demo/index.html`のasset URLが`/html-surface-three/`から始まる
- リリース判定テストがPASS
- whitespace errorなし

利用可能なら`actionlint`も実行する。未導入の場合は依存を増やさず、GitHub ActionsのPR検証を最終構文検査とする。

### Step 5: コミット

```powershell
git add .github/workflows package.json package-lock.json
git commit -m "ci: Pagesと安全な公開ワークフローを追加"
```

---

## Task 3: 公開コミュニティ・セキュリティファイル

**Files:**

- Create: `.github/CONTRIBUTING.md`
- Create: `.github/SECURITY.md`
- Create: `.github/CODEOWNERS`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/dependabot.yml`

### Step 1: 貢献・セキュリティ方針を書く

公開利用者向けの本文は英語にする。

`CONTRIBUTING.md`:

- fork + PR
- Node要件
- setup／検証コマンド
- stable APIと`experimental`の区別
- UI変更時のscreenshot／E2E証跡
- Contributorが権利を持つコードだけを提出すること

`SECURITY.md`:

- 対象versionは最新RC
- 公開Issueに脆弱性詳細を書かない
- GitHub Private vulnerability reportingを使う
- 返信SLAを約束しすぎず、受領確認の目安だけを書く

`CODEOWNERS`:

```text
* @solu199
```

### Step 2: Issue／PRテンプレートを追加する

Bug Formの必須項目:

- package version
- Three.js version
- browser／OS
- Backend
- reproduction
- expected／actual behavior

Feature Form:

- use case
- HTML Surface責務との関係
- 代替案

空Issueは無効にする。Securityは`SECURITY.md`へ誘導する。

### Step 3: Dependabotを追加する

npmとGitHub Actionsを週次で確認し、同種更新をgroup化してPR数を抑える。open PR上限を小さく保つ。

### Step 4: 検証してコミット

Run:

```powershell
git diff --check
Get-ChildItem .github -Recurse
```

Expected: 必須ファイルが全て存在し、末尾空白なし。

Commit:

```powershell
git add .github
git commit -m "docs: 公開コントリビューション導線を整備"
```

---

## Task 4: README、変更履歴、公開ヒーロー

**Files:**

- Modify: `README.md`
- Create: `README.ja.md`
- Modify: `CHANGELOG.md`
- Create: `.github/readme.gif`または`.github/readme.webp`
- Modify: `docs/api.md`
- Modify: `docs/backends.md`
- Modify: `docs/browser-support.md`
- Modify: `docs/limitations.md`
- Modify: `docs/migration-rc1.md`
- Modify: `docs/research/2026-07-24-html-surface-landscape.md`（公開URLや表現に更新が必要な場合のみ）

### Step 1: 決定論的なE2E証跡を生成する

Run:

```powershell
npm run test:e2e:evidence
```

Expected: `artifacts/evidence`以下にvideo、trace、screenshot、HTML reportが生成される。

videoがREADME用として十分明瞭なら、ffmpegで短時間・低fps・幅1200px以下のGIFまたはWebPへ変換する。大きすぎる場合は既存の決定論的screenshotをWebPへ変換する。ヒーローの目標は5MB未満とし、README表示速度を優先する。

### Step 2: 英語READMEを書く

`README.md`を次の順序にする。

1. ヒーローとライブデモ
2. 日本語版リンク
3. npm／CI／MIT／Three.jsバッジ
4. HTML Surfaceの定義
5. “Why not just an HTML texture?”
6. `npm install html-surface-three@next`
7. Vanilla API例
8. React mount例
9. Backendと段階保証
10. 制約、docs、contributing、security、MIT

Private repository、未公開、`docs/superpowers`への導線を除く。

### Step 3: 日本語READMEを書く

`README.ja.md`は英語版と同じコマンド、version、URL、保証範囲を持たせる。本文は既存READMEを再利用し、公開後の導入方法へ更新する。

### Step 4: CHANGELOGと公開docsを更新する

- 「npm未公開」「private」を削除
- `0.1.0-rc.1`の公開日を記載
- npm、Pages、Release導線を追加
- `docs/superpowers`へのリンクを公開docsから除去
- 既存ライブラリとの差を断定しすぎず、調査日を維持

Run:

```powershell
rg -n "private|未公開|docs/superpowers|npmレジストリにはまだ" README.md README.ja.md CHANGELOG.md docs
```

Expected: 公開状態と矛盾する文言またはリンクが0件。引用・研究上必要な`private`語がある場合は内容を目視確認する。

### Step 5: READMEとヒーローを目視検証する

- ローカルMarkdown previewまたはGitHub相当renderで画像、表、コードブロック、リンクを確認
- `view_image`でヒーローのReact UI、3Dモニター、遮蔽が判別できることを確認
- animationの場合はファイルサイズとループを確認

### Step 6: コミット

```powershell
git add README.md README.ja.md CHANGELOG.md .github/readme.* docs
git commit -m "docs: 公開向けREADMEとリリース案内を整備"
```

---

## Task 5: 内部設計資料を公開ツリーから外す

**Files:**

- Remove from Git tree: `docs/superpowers/**`
- Local-only modify: repository-local Git exclude file

### Step 1: ローカル保持先と除外設定を確認する

Run:

```powershell
git rev-parse --git-path info/exclude
Get-ChildItem docs\superpowers -Recurse
```

Expected: 設計書と計画書がローカルに存在する。

### Step 2: Git追跡だけを外す

```powershell
git rm --cached -r -- docs/superpowers
```

`docs/superpowers/`を`git rev-parse --git-path info/exclude`で得たローカルexcludeへ追加する。ファイル本体を削除しない。

### Step 3: 公開ツリーとローカル保持を確認する

Run:

```powershell
Test-Path docs\superpowers\specs\2026-07-24-public-release-design.md
git ls-files docs/superpowers
git status --short
```

Expected:

- `Test-Path`は`True`
- `git ls-files docs/superpowers`は0件
- statusには追跡削除だけが表示され、untracked内部docsは表示されない

### Step 4: コミット

```powershell
git add -u -- docs/superpowers
git commit -m "chore: 内部設計資料を公開ツリーから除外"
```

---

## Task 6: 公開候補をローカルで完全検証する

**Files:**

- No source changes expected
- Generated and ignored: `dist/`, `dist-demo/`, `artifacts/`, temporary tarball

### Step 1: clean install相当の検証

Run:

```powershell
npm ci
npm run verify
```

Expected: typecheck、unit/integration、library build、demo build、tarball consumer verificationが全てPASS。

### Step 2: stable／fallback browser検証

Run:

```powershell
npm run test:e2e:tier1
npm run test:visual
npm run test:e2e:smoke
```

Expected:

- stable Chrome／Edge Tier 1 PASS
- visual snapshot PASS
- Firefox／WebKit smoke PASS

失敗時は`systematic-debugging`スキルを使い、原因を特定してから修正する。

### Step 3: publish dry-runとtarball監査

Run:

```powershell
npm pack --dry-run --json
npm publish --dry-run --access public --tag next
```

Expected:

- package nameは`html-surface-three`
- versionは`0.1.0-rc.1`
- `docs/superpowers`、`dist-demo`、`artifacts`なし
- npm auth以外のwarningなし

### Step 4: git状態を確認する

Run:

```powershell
git status --short
git log --oneline origin/main..HEAD
```

Expected: worktreeはclean。公開変更だけがcommitされている。

---

## Task 7: Push、Pull Request、GitHub CI、マージ

### Step 1: ブランチをpushする

```powershell
git push -u origin haru-codex/public-release
```

### Step 2: 日本語のPull Requestを作る

PR本文へ次を含める。

- 公開README／Pages／npm workflow
- community/security整備
- 内部設計資料をcurrent treeから除外しローカル保持
- stable browserの検証結果
- npm公開、visibility変更、tag作成はPRマージ後であること

### Step 3: GitHub CIを確認する

必須:

- `verify`
- `tier1`
- `tier2`
- CodeQL

失敗した場合はログを確認し、`gh-fix-ci`の手順に従って修正する。

### Step 4: PRをマージする

全check成功後にmergeする。マージ後の`origin/main` SHAを記録し、以後のnpm packageとtagはそのSHAだけを使う。

---

## Task 8: リポジトリをPublic化し、GitHub設定とPagesを適用

### Step 1: 公開直前監査

Run:

```powershell
git fetch origin
git ls-tree -r --name-only origin/main
gh api repos/solu199/html-surface-three/collaborators
gh secret list --repo solu199/html-surface-three
```

Expected:

- `docs/superpowers`なし
- secretや内部artifactなし
- direct collaboratorは`solu199`だけ
- 公開してはいけないActions secretなし

### Step 2: visibilityをPublicへ変更する

```powershell
gh repo edit solu199/html-surface-three `
  --visibility public `
  --accept-visibility-change-consequences
```

これは不可逆性の高い境界である。実行後、APIで`visibility: public`を確認する。

### Step 3: repository metadataを設定する

- descriptionを英語の価値提案へ更新
- homepageを`https://solu199.github.io/html-surface-three/`へ更新
- topicsを設定
- Issuesを維持
- Projects／Wikiを無効化

### Step 4: Actions／security設定を適用する

- Actions default workflow permissionをread-only
- PR approval権限をActionsへ与えない
- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Push protection
- Private vulnerability reporting
- Code scanningが利用可能なことを確認

APIがプランやリポジトリ種別によって拒否した設定は、曖昧に成功扱いせず記録し、利用可能な代替を適用する。

### Step 5: Pagesを有効化しdeployする

Pagesのbuild typeをGitHub Actionsへ設定し、必要なら`pages.yml`を手動dispatchする。deploy完了までstatusを確認する。

### Step 6: 本番デモを検証する

URL:

```text
https://solu199.github.io/html-surface-three/
```

確認:

- HTTP 200
- JS／CSS asset 404なし
- moving React monitor表示
- button、input、scroll
- Vanilla Surface
- occlusion toggle
- console errorなし

この検証が失敗した場合はnpm公開へ進まない。

---

## Task 9: npmへ`0.1.0-rc.1`を初回公開

### Step 1: cleanなmainを固定する

公開に使うworktreeを`origin/main`のmerge SHAへ合わせ、statusがcleanであることを確認する。branch上の未マージ成果物や生成物をpublishしない。

Run:

```powershell
npm whoami
npm view html-surface-three
npm run verify:package
npm pack --dry-run --json
```

Expected:

- npm userは`solu199`
- package nameは未登録
- versionは`0.1.0-rc.1`
- tarball内容がTask 6と一致

package nameが他者に取得されていた場合は、scope変更を独断で行わず停止する。

### Step 2: 初回publishを実行する

```powershell
npm publish --access public --tag next
```

npmがWebAuthn／2FAを要求した場合だけユーザーがローカル端末で認証する。パスワード、OTP、recovery codeをチャットやログへ出さない。

Expected: `+ html-surface-three@0.1.0-rc.1`。

### Step 3: registryを検証する

```powershell
npm view html-surface-three@0.1.0-rc.1 version dist-tags repository homepage
npm view html-surface-three dist-tags
```

Expected:

- version `0.1.0-rc.1`
- `next: 0.1.0-rc.1`
- `latest`は存在しない、またはRC1を指していない

### Step 4: 別プロジェクトからinstallする

安全な一時ディレクトリを作り、次を実行する。

```powershell
npm init -y
npm install html-surface-three@next three@0.185.1
```

ESM runtime importとTypeScript typecheckを実行する。

Expected: package名、export、型がregistryから解決する。

失敗した場合はtagを作らない。同versionを上書きせず、必要ならdeprecateして修正版RCを準備する。

---

## Task 10: Trusted Publishing、Git tag、GitHub Prerelease

### Step 1: npm Trusted Publishingを設定する

GitHub repositoryと`.github/workflows/publish.yml`をnpm packageへ登録する。

候補コマンド:

```powershell
npm trust github html-surface-three `
  --repo solu199/html-surface-three `
  --file publish.yml `
  --allow-publish
```

実行前に現在のnpm CLI helpで引数を確認する。WebAuthnが必要な場合だけユーザーが認証する。

設定後、trusted publisherを一覧で確認し、長期`NPM_TOKEN`がGitHub Secretsに存在しないことを再確認する。

### Step 2: 注釈付きtagを作成してpushする

Task 7で記録したmerge SHAが現在の`main` HEADと一致することを確認する。

```powershell
git tag -a v0.1.0-rc.1 -m "release: 0.1.0-rc.1"
git push origin v0.1.0-rc.1
```

Expected: publish workflowはregistry上の既存versionを検出し、再公開せず成功する。

### Step 3: GitHub Prereleaseを作成する

日本語のRelease noteへ次を記載する。

- HTML Surfaceの定義
- React／Vanilla Surface
- 入力、UV、遮蔽、lifecycle
- stable/polyfillとexperimental/native
- Tier 1／2
- 既知の制約
- npm install
- Pages、CHANGELOG、migrationへのリンク

```powershell
gh release create v0.1.0-rc.1 `
  --repo solu199/html-surface-three `
  --prerelease `
  --verify-tag `
  --title "v0.1.0-rc.1"
```

### Step 4: main／tag保護を適用する

`main`:

- PR必須
- `verify`、`tier1`、`tier2` status必須
- conversation resolution必須
- force-push／delete禁止
- approval count 0
- owner bypassを維持

`v*`:

- 作成を許可
- 作成後の更新／削除禁止

rulesetまたはbranch protection APIのresponseを保存し、実際の設定を再取得して確認する。

### Step 5: 最終監査

確認項目:

```powershell
gh repo view solu199/html-surface-three --json visibility,url,homepageUrl,description
gh release view v0.1.0-rc.1 --repo solu199/html-surface-three
npm view html-surface-three@next
git ls-remote --tags origin v0.1.0-rc.1
```

加えて次を確認する。

- Pagesが200で操作可能
- npm install成功
- GitHub ReleaseがPrerelease
- `main`と`v*`保護
- direct collaboratorはownerだけ
- Projects／Wiki無効、Issues有効
- security機能の実際の有効状態
- public treeに`docs/superpowers`なし
- ローカルには内部設計書が残っている
- git status clean

## 完了報告

完了時は次をまとめる。

- GitHub repository URL
- Pages URL
- npm package URLとinstall command
- tagとGitHub Release URL
- 実行した検証と結果
- 適用できたsecurity／permission設定
- GitHub個人リポジトリで利用できないTriage権限の扱い
- ユーザーが今後行う必要がある作業が残る場合のみ、その最小手順
