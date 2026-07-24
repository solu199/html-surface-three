import type {
  Mesh,
  Object3D,
} from 'three';

import { HtmlSurfaceError } from './errors';

export type SurfaceRegistration = {
  readonly id: string;
  readonly mesh: Mesh;
  readonly materialIndex: number;
  readonly enabled: boolean;
};

export class SurfaceRegistry<
  Surface extends SurfaceRegistration,
> {
  private readonly ids = new Map<string, Surface>();
  private readonly meshes = new Map<Object3D, Set<Surface>>();

  add(surface: Surface): void {
    if (this.ids.has(surface.id)) {
      throw new HtmlSurfaceError(
        'duplicate-surface-id',
        `HTML Surface ID "${surface.id}"は既に使用されています。`,
      );
    }

    this.ids.set(surface.id, surface);
    const values = this.meshes.get(surface.mesh) ?? new Set<Surface>();
    values.add(surface);
    this.meshes.set(surface.mesh, values);
  }

  remove(surface: Surface): void {
    if (this.ids.get(surface.id) === surface) {
      this.ids.delete(surface.id);
    }
    const values = this.meshes.get(surface.mesh);
    values?.delete(surface);
    if (values?.size === 0) {
      this.meshes.delete(surface.mesh);
    }
  }

  hasId(id: string): boolean {
    return this.ids.has(id);
  }

  resolve(
    object: Object3D,
    materialIndex = 0,
  ): Surface | undefined {
    let current: Object3D | null = object;
    while (current) {
      const surface = [...(this.meshes.get(current) ?? [])].find(
        (item) => (
          item.enabled
          && item.materialIndex === materialIndex
        ),
      );
      if (surface) {
        return surface;
      }
      current = current.parent;
    }

    return undefined;
  }

  values(): readonly Surface[] {
    return [...this.ids.values()];
  }
}
