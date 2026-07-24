import { describe, expect, it } from 'vitest';

import { createCapabilityReport } from '../src/core/capabilities';

describe('createCapabilityReport', () => {
  it('要求Backendと実際のBackend、入力能力、警告を分けて返す', () => {
    const report = createCapabilityReport({
      requested: 'native',
      active: 'polyfill',
      nativeAvailable: false,
      pointerEvents: true,
      pointerCapture: true,
      touch: true,
      webgl: true,
    });

    expect(report.backend).toEqual({
      requested: 'native',
      active: 'polyfill',
      nativeAvailable: false,
    });
    expect(report.input.keyboard).toBe(true);
    expect(report.input.ime).toBe(true);
    expect(report.rendering.requiresUv).toBe(true);
    expect(report.warnings.map((warning) => warning.code)).toContain(
      'native-backend-unavailable',
    );
  });
});
