const REQUIRED_FILES = [
  'dist/html-surface-three.js',
  'dist/experimental.js',
  'dist/index.d.ts',
  'dist/experimental.d.ts',
  'README.md',
  'README.ja.md',
  'LICENSE',
  'CHANGELOG.md',
  'package.json',
];

const ALLOWED_ROOT_FILES = new Set([
  'README.md',
  'README.ja.md',
  'LICENSE',
  'CHANGELOG.md',
  'package.json',
]);

export function assertPublicPackage({ files, manifest }) {
  for (const file of files) {
    if (!file.startsWith('dist/') && !ALLOWED_ROOT_FILES.has(file)) {
      throw new Error(`Public package must not include ${file}`);
    }
  }

  for (const file of REQUIRED_FILES) {
    if (!files.includes(file)) {
      throw new Error(`Missing packed file: ${file}`);
    }
  }

  if (
    manifest.name !== 'html-surface-three'
    || manifest.version !== '0.1.0-rc.1'
    || manifest.license !== 'MIT'
    || manifest.publishConfig?.access !== 'public'
  ) {
    throw new Error('Invalid public package metadata.');
  }
}
