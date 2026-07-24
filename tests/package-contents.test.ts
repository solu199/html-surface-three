import { describe, expect, it } from 'vitest';

import { assertPublicPackage } from '../scripts/package-contents.mjs';

const manifest = {
  name: 'html-surface-three',
  version: '0.1.0-rc.1',
  license: 'MIT',
  publishConfig: {
    access: 'public',
  },
};

const publicFiles = [
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

describe('assertPublicPackage', () => {
  it('allows only the public package roots', () => {
    expect(() => assertPublicPackage({
      files: publicFiles,
      manifest,
    })).not.toThrow();
  });

  it.each([
    'docs/superpowers/specs/internal.md',
    'dist-demo/index.html',
    'artifacts/playwright/trace.zip',
    '.npmrc',
    '.env',
  ])('rejects %s', (file) => {
    expect(() => assertPublicPackage({
      files: [...publicFiles, file],
      manifest,
    })).toThrow(/must not include/i);
  });

  it('requires public MIT package metadata', () => {
    expect(() => assertPublicPackage({
      files: publicFiles,
      manifest: {
        ...manifest,
        publishConfig: undefined,
      },
    })).toThrow(/public package metadata/i);
  });
});
