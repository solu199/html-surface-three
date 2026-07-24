import {
  HTMLTexture,
  LinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { installHtmlInCanvasPolyfill } from 'three-html-render/polyfill';

export type BackendKind = 'native' | 'polyfill';

export type HtmlTextureHandle = {
  readonly texture: Texture;
  invalidate(): void;
  dispose(): void;
};

export type HtmlTextureBackend = {
  readonly kind: BackendKind;
  mount(element: HTMLElement): HtmlTextureHandle;
  requestPaint(): void;
};

type HtmlCanvasElement = HTMLCanvasElement & {
  requestPaint?: () => void;
};

function hasNativeHtmlTextureUpload(canvas: HtmlCanvasElement): boolean {
  if (typeof canvas.requestPaint !== 'function') {
    return false;
  }

  const contextTypes = [
    globalThis.WebGLRenderingContext,
    globalThis.WebGL2RenderingContext,
  ];

  return contextTypes.some((contextType) => (
    contextType !== undefined
    && 'texElementImage2D' in contextType.prototype
  ));
}

export function createHtmlTextureBackend(
  sourceCanvas: HTMLCanvasElement,
): HtmlTextureBackend {
  const canvas = sourceCanvas as HtmlCanvasElement;
  const kind: BackendKind = hasNativeHtmlTextureUpload(canvas)
    ? 'native'
    : 'polyfill';

  if (kind === 'polyfill') {
    installHtmlInCanvasPolyfill();
  }

  canvas.setAttribute('layoutsubtree', '');

  const requestPaint = () => {
    canvas.requestPaint?.();
  };

  return {
    kind,
    requestPaint,
    mount(element) {
      if (element.parentElement !== canvas) {
        canvas.append(element);
      }

      const texture = new HTMLTexture(element);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;

      let disposed = false;
      const invalidate = () => {
        if (disposed) {
          return;
        }

        texture.needsUpdate = true;
        requestPaint();
      };

      const observer = new MutationObserver(invalidate);
      observer.observe(element, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });

      const invalidateEvents = ['input', 'change', 'scroll'] as const;
      for (const eventName of invalidateEvents) {
        element.addEventListener(eventName, invalidate, true);
      }

      invalidate();

      return {
        texture,
        invalidate,
        dispose() {
          if (disposed) {
            return;
          }

          disposed = true;
          observer.disconnect();
          for (const eventName of invalidateEvents) {
            element.removeEventListener(eventName, invalidate, true);
          }
          texture.dispose();
          element.remove();
        },
      };
    },
  };
}
