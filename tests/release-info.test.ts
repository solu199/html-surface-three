import { describe, expect, it } from 'vitest';

import { getReleaseInfo } from '../scripts/release-info.mjs';

describe('getReleaseInfo', () => {
  it('maps a matching prerelease tag to the next dist-tag', () => {
    expect(getReleaseInfo({
      packageName: 'html-surface-three',
      packageVersion: '0.1.0-rc.1',
      tagName: 'v0.1.0-rc.1',
    })).toEqual({
      version: '0.1.0-rc.1',
      tag: 'next',
      packageSpec: 'html-surface-three@0.1.0-rc.1',
    });
  });

  it('maps a matching stable tag to the latest dist-tag', () => {
    expect(getReleaseInfo({
      packageName: 'html-surface-three',
      packageVersion: '0.1.0',
      tagName: 'v0.1.0',
    })).toEqual({
      version: '0.1.0',
      tag: 'latest',
      packageSpec: 'html-surface-three@0.1.0',
    });
  });

  it('rejects a tag that does not match the package version', () => {
    expect(() => getReleaseInfo({
      packageName: 'html-surface-three',
      packageVersion: '0.1.0-rc.1',
      tagName: 'v0.1.0-rc.2',
    })).toThrow(/does not match/i);
  });

  it('rejects a tag without the v prefix', () => {
    expect(() => getReleaseInfo({
      packageName: 'html-surface-three',
      packageVersion: '0.1.0',
      tagName: '0.1.0',
    })).toThrow(/must start with v/i);
  });

  it('rejects an invalid semantic version', () => {
    expect(() => getReleaseInfo({
      packageName: 'html-surface-three',
      packageVersion: 'release-candidate',
      tagName: 'vrelease-candidate',
    })).toThrow(/semantic version/i);
  });
});
