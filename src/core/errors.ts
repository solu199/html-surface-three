export type HtmlSurfaceErrorCode =
  | 'manager-disposed'
  | 'duplicate-surface-id'
  | 'material-not-found'
  | 'material-index-out-of-range'
  | 'material-binding-conflict'
  | 'invalid-map-property'
  | 'backend-unavailable'
  | 'backend-initialization-failed'
  | 'surface-disposed';

export class HtmlSurfaceError extends Error {
  readonly code: HtmlSurfaceErrorCode;

  constructor(
    code: HtmlSurfaceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HtmlSurfaceError';
    this.code = code;
  }
}
