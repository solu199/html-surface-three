import {
  HTMLTexture,
  LinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { HtmlSurfaceError } from '../core/errors';
import { adaptLegacyHtmlTextureUpload } from './polyfill-compat';

type PolyfillModule = typeof import('three-html-render/polyfill');

let installHtmlInCanvasPolyfill:
  | PolyfillModule['installHtmlInCanvasPolyfill']
  | undefined;

if (
  typeof window !== 'undefined'
  && typeof Element !== 'undefined'
) {
  ({ installHtmlInCanvasPolyfill } = await import(
    'three-html-render/polyfill'
  ));
}

export type BackendKind = 'native' | 'polyfill';
export type BackendPreference = 'auto' | BackendKind;

export type HtmlTextureHandle = {
  readonly texture: Texture;
  readonly ready: Promise<void>;
  invalidate(): void;
  dispose(): void;
};

export type HtmlTextureBackend = {
  readonly kind: BackendKind;
  readonly nativeAvailable: boolean;
  mount(element: HTMLElement): HtmlTextureHandle;
  requestPaint(): void;
};

type HtmlCanvasElement = HTMLCanvasElement & {
  requestPaint?: () => void;
};

export function detectNativeHtmlInCanvas(
  sourceCanvas: HTMLCanvasElement,
): boolean {
  const canvas = sourceCanvas as HtmlCanvasElement;
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

export function selectBackendKind(
  requested: BackendPreference,
  nativeAvailable: boolean,
): BackendKind {
  if (requested === 'auto' || requested === 'polyfill') {
    return 'polyfill';
  }
  if (nativeAvailable) {
    return 'native';
  }

  throw new HtmlSurfaceError(
    'backend-unavailable',
    'native HTML-in-Canvas Backendを利用できません。',
  );
}

export function createHtmlTextureBackend(
  options: {
    sourceCanvas: HTMLCanvasElement;
    preference?: BackendPreference;
  },
): HtmlTextureBackend {
  const canvas = options.sourceCanvas as HtmlCanvasElement;
  const nativeAvailable = detectNativeHtmlInCanvas(canvas);
  const kind = selectBackendKind(
    options.preference ?? 'auto',
    nativeAvailable,
  );

  canvas.setAttribute('layoutsubtree', '');

  if (kind === 'polyfill') {
    if (!installHtmlInCanvasPolyfill) {
      throw new HtmlSurfaceError(
        'backend-unavailable',
        'polyfill BackendはDOM環境でのみ初期化できます。',
      );
    }
    installHtmlInCanvasPolyfill();
    const contextTypes = [
      globalThis.WebGLRenderingContext,
      globalThis.WebGL2RenderingContext,
    ];

    for (const contextType of contextTypes) {
      const prototype = contextType?.prototype as
        | (object & {
          texElementImage2D?: (...args: any[]) => unknown;
        })
        | undefined;

      if (typeof prototype?.texElementImage2D === 'function') {
        adaptLegacyHtmlTextureUpload(
          prototype as Parameters<typeof adaptLegacyHtmlTextureUpload>[0],
        );
      }
    }
  }

  const requestPaint = () => {
    canvas.requestPaint?.();
  };

  return {
    kind,
    nativeAvailable,
    requestPaint,
    mount(element) {
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

      const invalidateEvents = [
        'input',
        'change',
        'scroll',
        'compositionend',
      ] as const;
      for (const eventName of invalidateEvents) {
        element.addEventListener(eventName, invalidate, true);
      }

      invalidate();

      return {
        texture,
        ready: Promise.resolve(),
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
        },
      };
    },
  };
}
