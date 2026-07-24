import {
  RepeatWrapping,
  Texture,
  Vector2,
} from 'three';
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

  it('repeat、offset、rotation、flipYをTexture transformから反映する', () => {
    const texture = new Texture();
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.5, 0.75);
    texture.offset.set(0.1, 0.2);
    texture.rotation = Math.PI / 8;
    texture.center.set(0.5, 0.5);
    texture.flipY = true;
    texture.updateMatrix();

    const expected = new Vector2(0.3, 0.65);
    texture.transformUv(expected);
    const actual = copyAndTransformUv(
      { x: 0.3, y: 0.65 },
      (uv) => {
        const vector = new Vector2(uv.x, uv.y);
        texture.transformUv(vector);
        uv.x = vector.x;
        uv.y = vector.y;
      },
    );

    expect(actual.x).toBeCloseTo(expected.x);
    expect(actual.y).toBeCloseTo(expected.y);
  });
});
