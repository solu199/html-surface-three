import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { assertPublicPackage } from './package-contents.mjs';

const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'html-surface-three-'));
const packDirectory = join(temporary, 'pack');
const consumerDirectory = join(temporary, 'consumer');

function run(command, args, cwd) {
  let executable = command;
  let commandArgs = args;
  if (command === 'npm') {
    if (!process.env.npm_execpath) {
      throw new Error('Run this verifier through an npm script.');
    }
    executable = process.execPath;
    commandArgs = [process.env.npm_execpath, ...args];
  } else if (command === 'node') {
    executable = process.execPath;
  }

  const result = spawnSync(executable, commandArgs, {
    cwd,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed`,
      result.error?.stack,
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
  if (!packed?.filename) {
    throw new Error('npm pack filename was not returned.');
  }

  const sourceManifest = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  assertPublicPackage({
    files: packed.files.map((file) => file.path),
    manifest: sourceManifest,
  });

  const tarball = join(packDirectory, packed.filename);
  await writeFile(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({
      name: 'html-surface-three-consumer',
      private: true,
      type: 'module',
      dependencies: {
        'html-surface-three': `file:${tarball.replaceAll('\\', '/')}`,
        three: '0.185.1',
      },
      devDependencies: {
        typescript: '7.0.2',
      },
    }, null, 2),
  );
  await writeFile(
    join(consumerDirectory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        outDir: 'dist',
        skipLibCheck: true,
      },
      include: ['index.ts'],
    }, null, 2),
  );
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

const report = undefined as CapabilityReport | undefined;
const backend = undefined as HtmlTextureBackend | undefined;
console.log(JSON.stringify({
  exportsResolve: [
    typeof HtmlSurfaceManager,
    typeof HtmlSurfaceError,
    selectBackendKind('auto', false),
  ],
  report: report?.backend,
  backend: backend?.kind,
}));
`);

  run('npm', ['install', '--ignore-scripts'], consumerDirectory);
  run('node', [
    join(
      consumerDirectory,
      'node_modules',
      'typescript',
      'bin',
      'tsc',
    ),
  ], consumerDirectory);

  const manifest = JSON.parse(await readFile(
    join(
      consumerDirectory,
      'node_modules',
      'html-surface-three',
      'package.json',
    ),
    'utf8',
  ));
  if (manifest.version !== '0.1.0-rc.2') {
    throw new Error(`Unexpected installed version: ${manifest.version}`);
  }

  const runtimeOutput = run('node', ['dist/index.js'], consumerDirectory);
  const runtime = JSON.parse(runtimeOutput);
  if (
    runtime.exportsResolve[0] !== 'function'
    || runtime.exportsResolve[1] !== 'function'
    || runtime.exportsResolve[2] !== 'polyfill'
  ) {
    throw new Error(`Unexpected runtime exports: ${runtimeOutput}`);
  }

  console.log(`Verified ${packed.filename} in a clean consumer.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
