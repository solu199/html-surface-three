import {
  Material,
  type Mesh,
  type Texture,
} from 'three';

import { HtmlSurfaceError } from './errors';

type MaterialRecord = Material & {
  [key: string]: unknown;
};

export type MaterialBindingOptions = {
  mesh: Mesh;
  material?: Material;
  materialIndex?: number;
  mapProperty?: string;
  texture: Texture;
  disposeMaterial?: boolean;
  disposeGeometry?: boolean;
};

export type MaterialBinding = {
  readonly material: Material;
  readonly materialIndex: number;
  readonly mapProperty: string;
  restore(): { restored: boolean };
  disposeOwnedResources(): void;
};

export class MaterialBindingClaims {
  private readonly values = new WeakMap<Material, Set<string>>();

  claim(material: Material, property: string): void {
    const properties = this.values.get(material) ?? new Set<string>();
    if (properties.has(property)) {
      throw new HtmlSurfaceError(
        'material-binding-conflict',
        `Materialの${property}は既に別のHTML SurfaceへBindingされています。`,
      );
    }

    properties.add(property);
    this.values.set(material, properties);
  }

  release(material: Material, property: string): void {
    const properties = this.values.get(material);
    properties?.delete(property);
    if (properties?.size === 0) {
      this.values.delete(material);
    }
  }
}

function resolveMaterial(options: MaterialBindingOptions): Material {
  if (options.material) {
    return options.material;
  }

  const source = options.mesh.material;
  if (!source) {
    throw new HtmlSurfaceError(
      'material-not-found',
      'HTML Surfaceの対象Materialがありません。',
    );
  }
  if (!Array.isArray(source)) {
    return source;
  }

  const index = options.materialIndex ?? 0;
  const material = source[index];
  if (!material) {
    throw new HtmlSurfaceError(
      'material-index-out-of-range',
      `materialIndex ${index}は存在しません。`,
    );
  }

  return material;
}

export function bindSurfaceTexture(
  options: MaterialBindingOptions,
  claims: MaterialBindingClaims,
): MaterialBinding {
  const material = resolveMaterial(options) as MaterialRecord;
  const materialIndex = options.materialIndex ?? 0;
  const mapProperty = options.mapProperty ?? 'map';
  if (!(mapProperty in material)) {
    throw new HtmlSurfaceError(
      'invalid-map-property',
      `Materialに${mapProperty}プロパティがありません。`,
    );
  }

  claims.claim(material, mapProperty);
  const previous = material[mapProperty];
  material[mapProperty] = options.texture;
  material.needsUpdate = true;

  let released = false;
  let resourcesDisposed = false;
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    claims.release(material, mapProperty);
  };

  return {
    material,
    materialIndex,
    mapProperty,
    restore() {
      const restored = material[mapProperty] === options.texture;
      if (restored) {
        material[mapProperty] = previous;
        material.needsUpdate = true;
      }
      release();
      return { restored };
    },
    disposeOwnedResources() {
      if (resourcesDisposed) {
        return;
      }
      resourcesDisposed = true;
      if (options.disposeMaterial) {
        material.dispose();
      }
      if (options.disposeGeometry) {
        options.mesh.geometry.dispose();
      }
    },
  };
}
