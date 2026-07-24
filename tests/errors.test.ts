import { describe, expect, it } from 'vitest';

import { HtmlSurfaceError } from '../src/core/errors';

describe('HtmlSurfaceError', () => {
  it('安定したcodeとcauseを保持する', () => {
    const cause = new Error('upload failed');
    const error = new HtmlSurfaceError(
      'backend-initialization-failed',
      'Backendを初期化できませんでした。',
      { cause },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HtmlSurfaceError');
    expect(error.code).toBe('backend-initialization-failed');
    expect(error.cause).toBe(cause);
  });
});
