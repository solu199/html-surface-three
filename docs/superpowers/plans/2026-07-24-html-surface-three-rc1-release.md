# HTML Surface Three 0.1.0-rc.1 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** library、型定義、demo、ブラウザ互換性、文書、ライセンス、CI、tarball consumer検証を揃え、private GitHub上で`0.1.0-rc.1`としてレビュー可能なPRを作る。

**Architecture:** root exportは安定Facadeだけに限定し、Backend SPIは`./experimental`サブパスへ分ける。`npm pack`成果物を一時consumerへ実際にインストールし、package metadata、ESM import、型解決、不要ファイル混入を検証する。

**Tech Stack:** npm、TypeScript 7、Vite 8、Vitest 4、Playwright、GitHub Actions、MIT

## Global Constraints

- versionは`0.1.0-rc.1`。
- MITライセンス。
- npmレジストリへpublishしない。
- private GitHubリポジトリ上のPRとして完成させる。
- README、API、Backend、互換性、制約、移行、実行方法、Vanilla／React例を日本語で記述する。
- stable Chrome／EdgeはTier 1、Firefox／WebKitはTier 2。
- native HTML-in-Canvasは実験APIでありstable保証へ含めない。
- package consumerがroot APIだけでThree.js r185と型解決できる。
- コミットメッセージとPR本文は日本語で記述する。
- 検証は現在の出力を根拠にし、以前の成功結果を流用しない。

---

## File Structure

- Modify: `package.json` — RC version、metadata、exports、scripts
- Modify: `package-lock.json`
- Modify: `vite.lib.config.ts` — root／experimental multi-entry
- Modify: `tsconfig.lib.json` — declaration entry
- Create: `LICENSE`
- Create: `CHANGELOG.md`
- Create: `docs/api.md`
- Create: `docs/backends.md`
- Create: `docs/browser-support.md`
- Create: `docs/limitations.md`
- Create: `docs/migration-rc1.md`
- Modify: `README.md`
- Create: `scripts/verify-package.mjs`
- Create: `.github/workflows/ci.yml`
- Modify: `.gitignore`

### Task 1: package metadata、exports、MIT

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.lib.config.ts`
- Modify: `tsconfig.lib.json`
- Create: `LICENSE`

**Interfaces:**
- Produces: package exports `.`と`./experimental`
- Consumes: `src/index.ts`、`src/experimental.ts`

- [ ] **Step 1: package metadataをRCへ変更する**

`package.json`の該当項目を次へする。

```json
{
  "name": "html-surface-three",
  "version": "0.1.0-rc.1",
  "private": false,
  "type": "module",
  "description": "HTMLElementを操作可能なThree.js Mesh表面として管理するHTML Surfaceライブラリ",
  "license": "MIT",
  "author": "HTML Surface Three contributors",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/solu199/html-surface-three.git"
  },
  "bugs": {
    "url": "https://github.com/solu199/html-surface-three/issues"
  },
  "homepage": "https://github.com/solu199/html-surface-three#readme",
  "keywords": [
    "three.js",
    "html",
    "texture",
    "webgl",
    "interaction",
    "react"
  ],
  "main": "./dist/html-surface-three.js",
  "module": "./dist/html-surface-three.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/html-surface-three.js"
    },
    "./experimental": {
      "types": "./dist/experimental.d.ts",
      "import": "./dist/experimental.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "sideEffects": false,
  "engines": {
    "node": "^20.19.0 || >=22.12.0"
  },
  "peerDependencies": {
    "three": ">=0.184.0 <0.186.0"
  }
}
```

既存のdependencies、devDependencies、scriptsを保持し、`npm install --package-lock-only`でlockfileのroot metadataを同期する。

- [ ] **Step 2: multi-entry library buildを実装する**

`vite.lib.config.ts`:

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        experimental: resolve(import.meta.dirname, 'src/experimental.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => (
        entryName === 'index' ? 'html-surface-three' : entryName
      ),
    },
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      external: (id) => id === 'three'
        || id.startsWith('three/')
        || id === 'three-html-render'
        || id.startsWith('three-html-render/'),
    },
  },
});
```

`tsconfig.lib.json`のincludeへ`src/experimental.ts`を追加する。

- [ ] **Step 3: MIT LICENSEを追加する**

`LICENSE`:

```text
MIT License

Copyright (c) 2026 HTML Surface Three contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: build outputとexportsを確認する**

Run: `npm install --package-lock-only && npm run build:lib`

Expected files:

- `dist/html-surface-three.js`
- `dist/experimental.js`
- `dist/index.d.ts`
- `dist/experimental.d.ts`

Run: `node -e "import('./dist/html-surface-three.js').then(m => console.log(Object.keys(m).sort()))"`

Expected: stable APIのみ表示され、Backend factoryは含まれない。

- [ ] **Step 5: コミットする**

```bash
git add package.json package-lock.json vite.lib.config.ts tsconfig.lib.json LICENSE
git commit -m "chore: 0.1.0-rc.1の配布設定を追加"
```

### Task 2: tarball consumer検証

**Files:**
- Create: `scripts/verify-package.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run verify:package`
- Consumes: `npm pack --json`、一時consumer、package exports

- [ ] **Step 1: package verifierを実装する**

`scripts/verify-package.mjs`:

```js
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'html-surface-three-'));
const packDirectory = join(temporary, 'pack');
const consumerDirectory = join(temporary, 'consumer');

function run(command, args, cwd) {
  const executable = (
    process.platform === 'win32'
    && (command === 'npm' || command === 'npx')
  )
    ? `${command}.cmd`
    : command;
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed`,
      result.stdout,
      result.stderr,
    ].join('\n'));
  }
  return result.stdout.trim();
}

try {
  await mkdir(packDirectory, { recursive: true });
  await mkdir(consumerDirectory, { recursive: true });
  const packOutput = run(
    'npm',
    ['pack', '--json', '--pack-destination', packDirectory],
    root,
  );
  const [packed] = JSON.parse(packOutput);
  if (!packed?.filename) throw new Error('npm pack filename was not returned.');
  const expected = new Set([
    'dist/html-surface-three.js',
    'dist/experimental.js',
    'dist/index.d.ts',
    'dist/experimental.d.ts',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'package.json',
  ]);
  const files = new Set(packed.files.map((file) => file.path));
  for (const file of expected) {
    if (!files.has(file)) throw new Error(`Missing packed file: ${file}`);
  }
  if ([...files].some((file) => file.startsWith('src/'))) {
    throw new Error('Package must not include src/.');
  }

  const tarball = join(packDirectory, packed.filename);
  await writeFile(join(consumerDirectory, 'package.json'), JSON.stringify({
    name: 'html-surface-three-consumer',
    private: true,
    type: 'module',
    scripts: {
      check: 'tsc --noEmit && node dist/index.js',
    },
    dependencies: {
      'html-surface-three': `file:${tarball.replaceAll('\\', '/')}`,
      three: '0.185.1',
    },
    devDependencies: {
      typescript: '7.0.2',
    },
  }, null, 2));
  await writeFile(join(consumerDirectory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      outDir: 'dist',
      skipLibCheck: true,
    },
    include: ['index.ts'],
  }, null, 2));
  await writeFile(join(consumerDirectory, 'index.ts'), `
    import {
      HtmlSurfaceError,
      HtmlSurfaceManager,
      type CapabilityReport,
    } from 'html-surface-three';
    import {
      selectBackendKind,
      type HtmlTextureBackend,
    } from 'html-surface-three/experimental';

    const exportsResolve = [
      typeof HtmlSurfaceManager,
      typeof HtmlSurfaceError,
      selectBackendKind('auto', false),
    ];
    const report = undefined as CapabilityReport | undefined;
    const backend = undefined as HtmlTextureBackend | undefined;
    console.log(JSON.stringify({
      exportsResolve,
      report: report?.backend,
      backend: backend?.kind,
    }));
  `);
  run('npm', ['install', '--ignore-scripts'], consumerDirectory);
  run('npx', ['--no-install', 'tsc'], consumerDirectory);
  const manifest = JSON.parse(
    await readFile(join(consumerDirectory, 'node_modules', 'html-surface-three', 'package.json'), 'utf8'),
  );
  if (manifest.version !== '0.1.0-rc.1') {
    throw new Error(`Unexpected installed version: ${manifest.version}`);
  }
  run('node', ['dist/index.js'], consumerDirectory);
  console.log(`Verified ${packed.filename} in a clean consumer.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
```

- [ ] **Step 2: package scriptを追加する**

```json
{
  "scripts": {
    "verify:package": "npm run build:lib && node scripts/verify-package.mjs"
  }
}
```

- [ ] **Step 3: verifierを実行し、失敗箇所をpackage設定側で直す**

Run: `npm run verify:package`

Expected: `Verified html-surface-three-0.1.0-rc.1.tgz in a clean consumer.`

tarball、temporary consumer、`src/`混入、root／experimental exportのどれかが失敗した場合、テストを弱めず`package.json`、Vite、declaration出力を修正する。

- [ ] **Step 4: コミットする**

```bash
git add scripts/verify-package.mjs package.json package-lock.json .gitignore
git commit -m "test: tarball consumer検証を追加"
```

### Task 3: 日本語ドキュメントとCHANGELOG

**Files:**
- Create: `CHANGELOG.md`
- Create: `docs/api.md`
- Create: `docs/backends.md`
- Create: `docs/browser-support.md`
- Create: `docs/limitations.md`
- Create: `docs/migration-rc1.md`
- Modify: `README.md`

**Interfaces:**
- Documents: 安定API、experimental API、段階保証、制約、移行、Vanilla／React例、実行方法

- [ ] **Step 1: CHANGELOGを追加する**

`CHANGELOG.md`は次の見出しと内容を持つ。

```md
# 変更履歴

## 0.1.0-rc.1

最初のリリース候補です。npmレジストリにはまだ公開していません。

### 追加

- HTMLElementと任意Meshを関連付けるHTML Surface
- Materialスロット、map property、UV変換
- 複数Surface、通常Meshを含む遮蔽判定
- pointer、focus、keyboard、IME、wheel、scroll、drag、touch
- Pointer Captureと動くMeshへの毎フレーム追従
- stable優先polyfill Backendと実験native Backend
- CapabilityReportと型付きエラー
- moving monitor上のReactサイトとVanilla Surface
- Unit、Integration、Chrome／Edge E2E、Firefox／WebKit smoke、視覚比較

### 互換性

- Three.js `>=0.184.0 <0.186.0`
- Node.js `^20.19.0 || >=22.12.0`
- Tier 1: stable Chrome、stable Edge
- Tier 2: stable Firefox、Playwright WebKit

### 既知の制約

- native HTML-in-Canvasは実験扱い
- polyfillはSVG foreignObjectとTexture uploadのコストを持つ
- iframe、DRM、クロスオリジンメディアを完全にTexture化できるとは限らない
```

- [ ] **Step 2: API文書を追加する**

`docs/api.md`に次を実際のRC1 signatureと一致させて記載する。

- `HtmlSurfaceManagerOptions`
- `HtmlSurfaceOptions`
- `HtmlSurfaceManager`
- `HtmlSurface`
- `CapabilityReport`
- `HtmlSurfaceError`
- `HtmlSurfaceDebugState`
- Material所有権とdispose順
- `manager.update()`をrender loopで必ず呼ぶ理由
- Vanillaコード例
- React rootを利用者がunmountするコード例

各プロパティは「型」「既定値」「所有権」「throwされるerror code」を表で記載する。

- [ ] **Step 3: Backendと互換性文書を追加する**

`docs/backends.md`:

- HTML SurfaceとTexture Backendの責務差
- `auto`／`polyfill`／`native`
- `three-html-render`依存
- `./experimental` import例
- native経路が互換性保証外であること
- 将来のR3F／WebXR／画像／動画Adapter境界

`docs/browser-support.md`:

- Tier表
- 実行したPlaywright projectと日付
- Chrome／Edge全シナリオ
- Firefox／WebKit smoke
- WebKitはSafariそのものではない注意
- 実Safari手動確認チェックリスト
- keyboard、IME、touchの保証範囲

- [ ] **Step 4: 制約と移行文書を追加する**

`docs/limitations.md`:

- CSS／font／form control差
- CORS、iframe、DRM
- UV重複、UVなし、SkinnedMesh、InstancedMesh
- paint／Texture uploadコスト
- accessibility treeと3D位置
- Raycast性能
- native APIの実験状態

`docs/migration-rc1.md`:

- 0.0.0 prototypeから維持されるAPI
- `backend: 'auto'`のstable優先変更
- `setEnabled()`と`ready`
- Material Binding競合エラー
- typed errors
- dispose時の外部Material変更保護
- Backend SPIの`./experimental`移動

- [ ] **Step 5: READMEをRC1向けに全面更新する**

README冒頭を`0.1.0-rc.1`へ変更し、次の順で記載する。

1. HTML Surfaceの定義
2. 30秒で試す手順
3. moving monitorの画像または動画
4. 実現できたこと
5. Vanilla使用例
6. React使用例
7. Backend選択
8. ブラウザ保証
9. 現時点の制約
10. 既存ライブラリとの違い
11. 今後追加すべき機能
12. 開発／テスト／build／package検証
13. 詳細文書リンク
14. MIT

「ライセンス未決定」「Safari未検証」「pointer capture未完」などprototypeの古い記述を残さない。

- [ ] **Step 6: 文書内API名と古い状態を検索する**

Run:

```bash
rg -n "0\.0\.0|ライセンスは未決定|pointer capture.*未完|Safari.*未検証|CapabilityReport.*追加せず" README.md docs CHANGELOG.md
```

Expected: prototype設計の履歴説明以外に古い現状表現がない。プロトタイプ設計は履歴として変更しない。

Run:

```bash
rg -n "HtmlSurfaceManager|HtmlSurface|CapabilityReport|HtmlSurfaceError|setEnabled|experimental" README.md docs/api.md docs/backends.md docs/migration-rc1.md
```

Expected: 各公開概念に使用例または説明がある。

- [ ] **Step 7: コミットする**

```bash
git add README.md CHANGELOG.md docs/api.md docs/backends.md docs/browser-support.md docs/limitations.md docs/migration-rc1.md
git commit -m "docs: RC1のAPIと互換性を文書化"
```

### Task 4: CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: unit/build/package、Tier 1、Tier 2のGitHub checksとPlaywright artifacts

- [ ] **Step 1: 統合verify scriptを追加する**

```json
{
  "scripts": {
    "verify": "npm run typecheck && npm test && npm run build && npm run verify:package"
  }
}
```

`build`がtypecheck/testを内包して重複する場合は次へ整理する。

```json
{
  "scripts": {
    "build": "npm run build:lib && npm run build:demo",
    "verify": "npm run typecheck && npm test && npm run build && npm run verify:package"
  }
}
```

- [ ] **Step 2: GitHub Actions workflowを実装する**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run verify

  tier1:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install chrome msedge
      - run: npm run test:e2e:tier1
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-tier1
          path: artifacts/
          if-no-files-found: ignore

  tier2:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps firefox webkit
      - run: npm run test:e2e:smoke
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-tier2
          path: artifacts/
          if-no-files-found: ignore
```

- [ ] **Step 3: workflowとlocal verifyを確認する**

Run: `npm run verify`

Expected: typecheck、unit/integration、library/demo build、tarball consumerがすべてPASS。

Run: `npm run test:e2e:tier1 && npm run test:e2e:smoke`

Expected: Tier 1、Tier 2すべてPASS。

- [ ] **Step 4: コミットする**

```bash
git add .github/workflows/ci.yml package.json package-lock.json
git commit -m "ci: RC1の検証workflowを追加"
```

### Task 5: 完了監査、push、PR

**Files:**
- Modify only when audit identifies a concrete defect

**Interfaces:**
- Produces: private GitHub上のready-for-review PR

- [ ] **Step 1: 設計要件を証拠へ対応付ける**

`docs/superpowers/specs/2026-07-24-html-surface-three-rc1-design.md`の各節について、次を記録する。

| 要件 | 証拠 |
|---|---|
| 安定Facade | `src/index.ts`、API docs、consumer compile |
| Backend境界 | `src/experimental.ts`、backend tests |
| 複数Surface／Material／UV | unit tests、Vanilla demo |
| 遮蔽入力 | hit tests、Tier 1 occlusion E2E |
| pointer／focus／keyboard／IME／scroll／drag／touch | input tests、Tier 1 E2E |
| lifecycle／errors／Capability | unit/integration、HUD |
| stable browsers | Playwright results |
| moving React monitor | demo、screenshots、video |
| package／docs | tarball verifier、README、docs |

間接証拠しかない項目は完了扱いにせず、対象テストまたは文書を追加する。

- [ ] **Step 2: fresh verificationを実行する**

Run:

```bash
npm ci
npm run verify
npm run test:e2e:tier1
npm run test:e2e:smoke
npm run test:visual
git diff --check
git status --short
```

Expected: 全コマンドexit 0、意図しない未追跡ファイルなし。

- [ ] **Step 3: package内容を最終確認する**

Run: `npm pack --dry-run`

Expected:

- package version `0.1.0-rc.1`
- `dist/`、README、LICENSE、CHANGELOGのみが主要成果物
- `src/`、tests、artifacts、worktreeが含まれない

- [ ] **Step 4: release候補の最終コミットを作る**

監査修正がある場合は、まず`git status --short`で変更ファイルを列挙し、RC1監査で自分が変更したpathだけを個別にstageする。

```bash
git status --short
git add -- README.md package.json src/index.ts
git commit -m "fix: RC1監査で見つかった不整合を修正"
```

上の`git add`は例示された3ファイルすべてを無条件に使わず、実際に`git status --short`へ表示され、監査で修正したファイルだけを指定する。変更がなければ空コミットを作らない。

- [ ] **Step 5: branchをpushする**

Run: `git push -u origin haru-codex/rc1-release`

Expected: private remoteへbranchが作成される。

- [ ] **Step 6: 日本語PRを作成する**

PR title:

```text
feat: HTML Surface Three 0.1.0-rc.1
```

PR本文:

```md
## 概要

HTML Surface Threeを`0.1.0-rc.1`相当へ発展させます。Vanilla APIを中核に、任意MeshへのMaterial／UV Binding、遮蔽対応入力、複数Surface、ライフサイクル、Capability診断を安定化しました。

## 主な変更

- 安定Facadeと実験Backend境界
- pointer、focus、keyboard、IME、wheel、scroll、drag、touch
- Materialスロット、UV変換、遮蔽判定
- moving 3D monitor上のReactサイトとVanilla Surface
- Chrome／Edge E2E、Firefox／WebKit smoke、視覚比較
- MIT、RC package metadata、tarball consumer検証
- 日本語API／Backend／互換性／制約／移行文書

## 検証

- `npm run verify`
- `npm run test:e2e:tier1`
- `npm run test:e2e:smoke`
- `npm run test:visual`
- `npm pack --dry-run`

## 既知の制約

- native HTML-in-Canvasは実験機能です
- Playwright WebKitは実Safariそのものではありません
- iframe、DRM、クロスオリジンメディア、WebXR入力はRC1保証外です
```

PRはdraftではなくready for reviewで作成する。

- [ ] **Step 7: GitHub checksを確認する**

Expected:

- verify PASS
- tier1 PASS
- tier2 PASS
- Playwright artifacts upload済み
- merge conflictなし

失敗時は`github:gh-fix-ci`スキルを使い、失敗logを根拠に修正して再pushする。

## Plan 4 Completion Gate

- [ ] version `0.1.0-rc.1`
- [ ] MIT LICENSE
- [ ] root／experimental package exports
- [ ] `npm run verify`
- [ ] `npm run test:e2e:tier1`
- [ ] `npm run test:e2e:smoke`
- [ ] `npm run test:visual`
- [ ] `npm pack --dry-run`
- [ ] README、API、Backend、互換性、制約、移行、CHANGELOG
- [ ] private GitHub branch push
- [ ] ready PR
- [ ] GitHub checks green
