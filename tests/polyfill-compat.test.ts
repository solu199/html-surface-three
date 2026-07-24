import { describe, expect, it } from 'vitest';
import { adaptLegacyHtmlTextureUpload } from '../src/backends/polyfill-compat';

describe('adaptLegacyHtmlTextureUpload', () => {
  it('keeps the legacy six-argument upload while preventing Three.js from selecting the three-argument path', () => {
    const calls: unknown[][] = [];
    const prototype = {
      texElementImage2D(
        target: unknown,
        level: unknown,
        internalFormat: unknown,
        ...rest: unknown[]
      ) {
        calls.push([target, level, internalFormat, ...rest]);
      },
    };

    expect(prototype.texElementImage2D.length).toBe(3);
    expect(adaptLegacyHtmlTextureUpload(prototype)).toBe(true);
    expect(prototype.texElementImage2D.length).toBe(6);

    prototype.texElementImage2D(
      'TEXTURE_2D',
      0,
      'RGBA',
      'RGBA',
      'UNSIGNED_BYTE',
      'element',
    );

    expect(calls).toEqual([[
      'TEXTURE_2D',
      0,
      'RGBA',
      'RGBA',
      'UNSIGNED_BYTE',
      'element',
    ]]);
    expect(adaptLegacyHtmlTextureUpload(prototype)).toBe(false);
  });
});
