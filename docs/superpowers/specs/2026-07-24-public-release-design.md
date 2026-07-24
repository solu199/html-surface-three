# HTML Surface Three 公開リリース設計

作成日: 2026-07-24

対象リリース: `0.1.0-rc.1`

対象リポジトリ: `solu199/html-surface-three`

## 1. 目的

`html-surface-three`を、初見の開発者が価値を理解し、ライブデモを操作し、npmから導入できる公開ライブラリとして整える。

公開時の主語はHTML描画方式ではなく、次の責務をまとめる「HTML Surface」とする。

> HTML Surfaceは、HTMLElementを描画ソース、Three.js Meshを表示対象として、テクスチャ生成、Materialへの適用、UV／DOM座標変換、入力ルーティング、遮蔽判定、ライフサイクルを一つの単位として管理する抽象化である。

独自価値はHTMLラスタライズ自体ではなく、任意Meshへの関連付け、遮蔽を含む入力ルーティング、複数Surface管理、所有権とライフサイクル管理に置く。HTML-in-Canvas、Three.js `HTMLTexture`、`three-html-render`は交換可能な描画Backendまたは低レベル基盤として説明する。

## 2. 今回の決定

- 公開方式は「キュレーション型公開」とする。
- npmでは非スコープ名`html-surface-three`を使用する。
- `0.1.0-rc.1`は`next` dist-tagで公開し、`latest`は変更しない。
- READMEは英語を本文とし、冒頭から日本語版へ移動できるようにする。
- GitHub Pagesで操作可能なデモを公開する。
- GitHub個人リポジトリの所有者とnpm ownerは`solu199`だけにする。
- 外部貢献者はforkとPull Requestを基本とする。
- `docs/superpowers/**`は公開時点のGitツリーから削除するが、ローカルにはGit管理対象外として保持する。
- 過去コミットは書き換えない。したがって内部設計書は過去履歴から参照できる状態を許容する。

## 3. 非目標

- `0.1.0`安定版としての保証
- React Three FiberやWebXRの新規Adapter実装
- HTMLラスタライザーの自作
- UIコンポーネント集の提供
- DOMオーバーレイ方式への変更
- React専用APIへの変更
- GitHub Organizationへの移管
- 複数メンテナー運用や自動リリースPRの導入

## 4. 公開リポジトリの情報設計

### 4.1 README

`README.md`は英語版とし、次の順序にする。

1. 軽量なヒーロー画像とライブデモへのリンク
2. 日本語版`README.ja.md`へのリンク
3. npm、CI、MIT、Three.js互換性の最小限のバッジ
4. HTML Surfaceを一文で説明する価値提案
5. HTML Textureとの違い
6. npm導入方法
7. Vanilla APIによる最小コード例
8. Reactで作ったHTMLElementを渡す例
9. 対応ブラウザと段階保証
10. 詳細ドキュメント、貢献、セキュリティ、ライセンスへのリンク

ヒーローは、動く3Dモニター上のReact UIを操作する決定論的なE2Eシナリオから作る。READMEの読み込みを阻害しない大きさへ圧縮し、クリック時はGitHub Pagesへ移動する。アニメーションが過度に重い場合は、静止WebPを優先してライブデモへ誘導する。

`README.ja.md`は英語版と同じ情報構造を保つ。公開直前に両言語のコマンド、バージョン、URLが一致していることを確認する。

### 4.2 公開ドキュメント

次を公開ツリーへ残す。

- `docs/api.md`
- `docs/backends.md`
- `docs/browser-support.md`
- `docs/limitations.md`
- `docs/migration-rc1.md`
- `docs/research/**`
- 公開デモの説明に必要な画像とスタイル資料

公開に不要な`docs/superpowers/**`は、実装とレビューが終わった後に`git rm --cached`相当で追跡対象から外す。ファイル本体はローカルに残し、リポジトリローカルの除外設定へ追加する。共有される`.gitignore`には内部文書の存在を示す規則を追加しない。

### 4.3 コミュニティファイル

以下を追加する。

- `.github/CONTRIBUTING.md`
- `.github/SECURITY.md`またはルート`SECURITY.md`
- `.github/CODEOWNERS`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/feature.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/dependabot.yml`

Issue Formではライブラリバージョン、Three.jsバージョン、ブラウザとOS、使用Backend、最小再現、期待結果を収集する。空のIssueは無効にする。PRテンプレートには変更範囲、検証内容、互換性への影響、画面変更時の証跡を含める。

### 4.4 GitHubメタデータ

- 説明文: HTML Surfaceの価値を短い英語で記述
- Homepage: `https://solu199.github.io/html-surface-three/`
- Topics: `threejs`, `html`, `texture`, `webgl`, `interaction`, `react`, `canvas`, `3d-ui`
- Issuesは有効
- 未使用のProjectsとWikiは無効
- GitHub Pagesを有効

## 5. ライブデモ設計

### 5.1 デモ内容

既存の`src/demo`を公開用の縦切りとして維持し、次を見せる。

- 動きと回転のある3Dモニター
- モニターMeshへ関連付けたReact製サイト
- 別Meshへ関連付けたVanilla HTMLパネル
- Reactナビゲーション
- button、text input、checkbox、range、scroll
- OrbitControlsとSurface入力の共存
- 移動する遮蔽物と明示的な遮蔽切り替え
- Backend、UV、DOM座標、focus、pointer captureを確認できるHUD
- `prefers-reduced-motion`への対応
- WebGL起動不可時の説明表示

デモの役割は見栄えだけではなく、任意Mesh、複数Surface、入力、遮蔽、ライフサイクルを一画面で確認できる実行可能な仕様書とすることにある。

### 5.2 GitHub Pages

Viteへ明示的なdeploy baseを渡し、通常のローカル開発では`/`、Pages用ビルドでは`/html-surface-three/`を使用する。

専用のPages workflowは次の責務だけを持つ。

1. `npm ci`
2. ライブラリとデモの検証済みビルド
3. `dist-demo`をPages artifactとしてアップロード
4. GitHub Pagesへデプロイ

workflowの権限は`contents: read`、`pages: write`、`id-token: write`に限定する。デプロイ後は本番URLで起動、React Surface表示、主要なbutton操作を確認する。

## 6. ブラウザ保証

既存の段階保証を公開READMEとドキュメントに一貫して記載する。

| Tier | 対象 | 保証 |
|---|---|---|
| Tier 1 | stable Chrome / Edge | moving、rotation、navigation、button、input、keyboard、checkbox、range drag、scroll、composition、複数Surface、遮蔽、capture、touch |
| Tier 2 | Playwright Firefox / WebKit | 起動、React Surface表示、button、input、scrollのsmoke |
| 手動確認 | 実Safari | 公開チェックリストに基づく確認 |
| Experimental | native HTML-in-Canvas対応環境 | 検出と明示選択のみ |

既定Backendは`polyfill`のままとし、stableブラウザで実験APIが偶然有効になっても挙動を変えない。native Backendは`experimental`エントリーポイントと明示指定に限定する。

## 7. npm公開設計

### 7.1 パッケージ内容

`package.json`の公開メタデータを英語で整え、`publishConfig.access`を`public`にする。`files`は次に限定する。

- `dist`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`

公開前に`npm pack --dry-run --json`と実tarballの内容を確認する。ソースマップ、認証情報、内部設計書、E2E artifact、デモビルドが意図せず含まれないことを検査する。

### 7.2 初回公開

初回は認証済みの`solu199` npmアカウントから、クリーンな`main`の成果物だけを使用する。

```sh
npm publish --access public --tag next
```

公開後に次を検証する。

- `npm view html-surface-three@0.1.0-rc.1`
- `npm view html-surface-three dist-tags`
- 空の一時プロジェクトで`npm install html-surface-three@next`
- ESM importと型解決
- packageに含まれるファイル

### 7.3 Trusted Publishing

初回パッケージ作成後、npm Trusted PublishingへGitHubリポジトリと`publish.yml`を登録する。長期`NPM_TOKEN`は作成しない。

将来のpublish workflowは`v*`タグを契機にし、次を確認してから公開する。

- タグ`vX.Y.Z`と`package.json`のversionが一致
- CI相当の検証が成功
- 同じversionがnpmに未公開
- prerelease versionなら`next`
- stable versionなら`latest`

workflow権限は`contents: read`と`id-token: write`に限定し、GitHub-hosted runnerと対応npm CLIを使ってprovenanceを生成する。今回の`v0.1.0-rc.1`はローカル初回公開後に作るため、workflowは既存versionを検出して安全にskipする。

## 8. Git tagとGitHub Release

npm公開と別プロジェクトからのinstall検証が成功した後、公開に使用した`main`の同一コミットへ注釈付きタグを作る。

```sh
git tag -a v0.1.0-rc.1 -m "release: 0.1.0-rc.1"
git push origin v0.1.0-rc.1
```

GitHub ReleaseはPrereleaseとして作成し、次を含める。

- HTML Surfaceの短い説明
- RC1で実現できた操作
- stable/polyfillとexperimental/nativeの区別
- 段階保証
- 既知の制約
- npm installコマンド
- ライブデモ、変更履歴、移行案内へのリンク

## 9. GitHub権限と保護

### 9.1 メンバー

- GitHub所有者: `solu199`
- npm owner: `solu199`
- 直接コラボレーター: 追加しない
- 外部貢献: fork + Pull Request

個人リポジトリではTriage／Maintainの細かなロールを利用できない。Issue整理担当を追加する必要が生じた時点でOrganization移管を検討する。

### 9.2 main保護

公開用PRのマージ後に、`main`へrulesetまたはbranch protectionを設定する。

- Pull Request経由を必須化
- CI status checkを必須化
- review conversationの解決を必須化
- force-push禁止
- branch削除禁止
- 一人運用のため他者承認数は0
- 緊急時に所有者が復旧できる明示的なbypassを維持

`v*`タグは作成を許可し、作成後の更新と削除を禁止する。

### 9.3 セキュリティ

- Actionsの既定権限を読み取り専用
- Dependabot alerts
- Dependabot security updates
- 週次の依存更新をまとめて提案
- Secret scanning
- Push protection
- Private vulnerability reporting
- TypeScript向けCodeQL
- `CODEOWNERS`を`@solu199`に設定

`SECURITY.md`では脆弱性を公開Issueに書かず、GitHubのPrivate vulnerability reportingを使用するよう案内する。

## 10. 実行順序と段階保証

1. 公開用ドキュメント、metadata、community files、workflowを実装
2. ローカルのunit、typecheck、build、package verificationを実行
3. stable Chrome / Edge Tier 1とFirefox / WebKit Tier 2を実行
4. READMEヒーローと公開成果物を目視確認
5. 公開用Pull Requestを作成
6. GitHub CI成功を確認してマージ
7. リポジトリをPublicへ変更
8. GitHub metadata、Pages、security設定を適用
9. Pages本番URLを検証
10. クリーンな`main`でnpm packageを再検証
11. `0.1.0-rc.1`を`next`へ公開
12. npm registryと別プロジェクトでinstallを検証
13. Trusted Publishingを設定
14. 注釈付きtagをpush
15. tag workflowが既存versionを安全にskipすることを確認
16. GitHub Prereleaseを作成
17. branch/tag rulesetを最終適用

各段階で失敗した場合は次の不可逆操作へ進まない。特にPages本番確認が失敗した場合はnpm公開せず、npm公開検証が失敗した場合はtagとGitHub Releaseを作らない。

## 11. ロールバック方針

- PRマージ前: ブランチ上で修正する。
- Public変更後・npm公開前: 必要なら一時的にPrivateへ戻して修正する。ただし公開中に作成されたforkなどは完全には取り消せない。
- npm公開後: 同じversionを上書きしない。重大問題は即座にdeprecateし、修正版RCを新しいversionで公開する。
- tag公開後: 保護されたtagを書き換えない。修正版は新しいtagとReleaseを作る。
- Pages失敗: npm公開前ならworkflowを修正する。npm公開後の表示障害はPagesだけを再デプロイする。

## 12. 完了条件

- GitHubリポジトリがPublicである。
- README英語版と日本語版が公開されている。
- GitHub PagesでReact／Vanilla HTML Surfaceを操作できる。
- Public URLで主要操作と遮蔽が確認できる。
- `html-surface-three@0.1.0-rc.1`がnpmの`next`からinstallできる。
- tag`v0.1.0-rc.1`とGitHub Prereleaseが存在する。
- Trusted Publishingが設定され、長期npm tokenが不要である。
- mainとrelease tagが保護されている。
- community/security filesとGitHub security機能が有効である。
- 公開ツリーに`docs/superpowers/**`が存在しない。

## 13. 参考資料

- [npm: Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/)
- [npm: Creating and publishing unscoped public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
- [npm: Adding dist-tags to packages](https://docs.npmjs.com/adding-dist-tags-to-packages/)
- [GitHub: Setting repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [GitHub: Permission levels for a personal account repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository)
- [GitHub: About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub: About community profiles for public repositories](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)
