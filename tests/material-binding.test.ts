import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Texture,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import { HtmlSurfaceError } from '../src/core/errors';
import {
  MaterialBindingClaims,
  bindSurfaceTexture,
} from '../src/core/material-binding';

describe('bindSurfaceTexture', () => {
  it('Textureを適用し、自分のTextureが残っている場合だけ元へ戻す', () => {
    const previous = new Texture();
    const texture = new Texture();
    const material = new MeshBasicMaterial({ map: previous });
    const mesh = new Mesh(new BoxGeometry(), material);
    const claims = new MaterialBindingClaims();

    const binding = bindSurfaceTexture({
      mesh,
      materialIndex: 0,
      mapProperty: 'map',
      texture,
    }, claims);

    expect(material.map).toBe(texture);
    expect(binding.restore()).toEqual({ restored: true });
    expect(material.map).toBe(previous);
    expect(() => bindSurfaceTexture({
      mesh,
      mapProperty: 'map',
      texture: new Texture(),
    }, claims)).not.toThrow();
  });

  it('利用者が後から変更したMaterial値を上書きしない', () => {
    const texture = new Texture();
    const external = new Texture();
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(new BoxGeometry(), material);
    const binding = bindSurfaceTexture({
      mesh,
      mapProperty: 'map',
      texture,
    }, new MaterialBindingClaims());

    material.map = external;

    expect(binding.restore()).toEqual({ restored: false });
    expect(material.map).toBe(external);
  });

  it('同じMaterial propertyへの二重Bindingを拒否する', () => {
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(new BoxGeometry(), material);
    const claims = new MaterialBindingClaims();
    bindSurfaceTexture({
      mesh,
      mapProperty: 'map',
      texture: new Texture(),
    }, claims);

    expect(() => bindSurfaceTexture({
      mesh,
      mapProperty: 'map',
      texture: new Texture(),
    }, claims)).toThrowError(HtmlSurfaceError);
  });

  it('明示所有したMaterialとGeometryだけを破棄する', () => {
    const material = new MeshBasicMaterial();
    const geometry = new BoxGeometry();
    const mesh = new Mesh(geometry, material);
    const materialDispose = vi.spyOn(material, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const binding = bindSurfaceTexture({
      mesh,
      mapProperty: 'map',
      texture: new Texture(),
      disposeMaterial: true,
      disposeGeometry: true,
    }, new MaterialBindingClaims());

    binding.disposeOwnedResources();

    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
  });

  it('既定ではMaterialとGeometryを破棄しない', () => {
    const material = new MeshBasicMaterial();
    const geometry = new BoxGeometry();
    const mesh = new Mesh(geometry, material);
    const materialDispose = vi.spyOn(material, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const binding = bindSurfaceTexture({
      mesh,
      texture: new Texture(),
    }, new MaterialBindingClaims());

    binding.disposeOwnedResources();

    expect(materialDispose).not.toHaveBeenCalled();
    expect(geometryDispose).not.toHaveBeenCalled();
  });
});
