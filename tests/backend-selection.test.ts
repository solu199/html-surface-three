// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import {
  selectBackendKind,
} from '../src/backends/html-texture-backend';
import { HtmlSurfaceError } from '../src/core/errors';

describe('selectBackendKind', () => {
  it('autoはnative利用可能でもstable優先でpolyfillを返す', () => {
    expect(selectBackendKind('auto', true)).toBe('polyfill');
  });

  it('明示nativeかつ利用可能ならnativeを返す', () => {
    expect(selectBackendKind('native', true)).toBe('native');
  });

  it('明示nativeが利用不能なら型付きエラーにする', () => {
    expect(() => selectBackendKind('native', false)).toThrowError(
      HtmlSurfaceError,
    );
  });
});
