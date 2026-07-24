type HtmlTextureUploadHost = {
  texElementImage2D: (...args: any[]) => unknown;
};

const adaptedHosts = new WeakSet<object>();

/**
 * three-html-render 0.1.x exposes the legacy six-argument implementation as a
 * function with length === 3 because its final arguments use a rest parameter.
 * Three.js r185 interprets length === 3 as the newer Chrome 150+ overload.
 */
export function adaptLegacyHtmlTextureUpload(
  prototype: HtmlTextureUploadHost,
): boolean {
  if (
    adaptedHosts.has(prototype)
    || prototype.texElementImage2D.length !== 3
  ) {
    return false;
  }

  const legacyUpload = prototype.texElementImage2D;

  function compatibleUpload(
    this: unknown,
    target: unknown,
    level: unknown,
    internalFormat: unknown,
    sourceFormat: unknown,
    sourceType: unknown,
    element: unknown,
  ) {
    return legacyUpload.call(
      this,
      target,
      level,
      internalFormat,
      sourceFormat,
      sourceType,
      element,
    );
  }

  const descriptor = Object.getOwnPropertyDescriptor(
    prototype,
    'texElementImage2D',
  );

  Object.defineProperty(prototype, 'texElementImage2D', {
    ...descriptor,
    value: compatibleUpload,
  });
  adaptedHosts.add(prototype);
  return true;
}
