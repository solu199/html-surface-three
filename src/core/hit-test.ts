import type { UvPoint } from './coordinates';

export type HitCandidate<ObjectType> = {
  distance: number;
  object: ObjectType;
  uv?: UvPoint;
};

export type FrontmostHit<ObjectType, SurfaceType> =
  | {
    kind: 'surface';
    hit: HitCandidate<ObjectType>;
    surface: SurfaceType;
    uv: UvPoint;
  }
  | {
    kind: 'blocked';
    hit: HitCandidate<ObjectType>;
  }
  | {
    kind: 'none';
  };

export function resolveFrontmostHit<ObjectType, SurfaceType>(
  hits: readonly HitCandidate<ObjectType>[],
  resolveSurface: (object: ObjectType) => SurfaceType | undefined,
  shouldIgnore: (object: ObjectType) => boolean,
): FrontmostHit<ObjectType, SurfaceType> {
  const sortedHits = [...hits].sort((a, b) => a.distance - b.distance);

  for (const hit of sortedHits) {
    if (shouldIgnore(hit.object)) {
      continue;
    }

    const surface = resolveSurface(hit.object);
    if (surface && hit.uv) {
      return {
        kind: 'surface',
        hit,
        surface,
        uv: hit.uv,
      };
    }

    return {
      kind: 'blocked',
      hit,
    };
  }

  return { kind: 'none' };
}
