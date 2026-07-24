export type UvPoint = {
  x: number;
  y: number;
};

export type DomPoint = {
  x: number;
  y: number;
};

export type DomSize = {
  width: number;
  height: number;
};

export type UvTransform = (uv: UvPoint) => void;

export function copyAndTransformUv(
  uv: UvPoint,
  transform?: UvTransform,
): UvPoint {
  const result = { x: uv.x, y: uv.y };
  transform?.(result);
  return result;
}

export function uvToDomPoint(uv: UvPoint, size: DomSize): DomPoint {
  return {
    x: uv.x * size.width,
    y: uv.y * size.height,
  };
}
