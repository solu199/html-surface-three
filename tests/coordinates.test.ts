import { describe, expect, it } from 'vitest';

import {
  copyAndTransformUv,
  uvToDomPoint,
} from '../src/core/coordinates';

describe('uvToDomPoint', () => {
  it('変換済みUVをDOMピクセル座標へ写像する', () => {
    expect(uvToDomPoint(
      { x: 0.25, y: 0.75 },
      { width: 800, height: 400 },
    )).toEqual({ x: 200, y: 300 });
  });

  it('Surface固有のUV変換を元のUVを変更せず適用する', () => {
    const source = { x: 0.2, y: 0.3 };
    const result = copyAndTransformUv(source, (uv) => {
      uv.x = 1 - uv.x;
      uv.y = 1 - uv.y;
    });

    expect(result.x).toBeCloseTo(0.8);
    expect(result.y).toBeCloseTo(0.7);
    expect(source).toEqual({ x: 0.2, y: 0.3 });
  });
});
