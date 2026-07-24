export {
  HtmlSurfaceManager,
  type HtmlSurface,
  type HtmlSurfaceDebugState,
  type HtmlSurfaceManagerOptions,
  type HtmlSurfaceOptions,
} from './HtmlSurfaceManager';

export {
  type BackendKind,
  type BackendPreference,
} from './backends/html-texture-backend';

export {
  copyAndTransformUv,
  uvToDomPoint,
  type DomPoint,
  type DomSize,
  type UvPoint,
  type UvTransform,
} from './core/coordinates';

export {
  HtmlSurfaceError,
  type HtmlSurfaceErrorCode,
} from './core/errors';

export {
  type CapabilityReport,
  type CapabilityWarning,
  type CapabilityWarningCode,
} from './core/capabilities';
