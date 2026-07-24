export type BackendPreference = 'auto' | 'polyfill' | 'native';
export type ActiveBackendKind = 'polyfill' | 'native';

export type CapabilityWarningCode =
  | 'native-backend-unavailable'
  | 'native-backend-experimental'
  | 'pointer-capture-unavailable'
  | 'touch-unavailable';

export type CapabilityWarning = {
  code: CapabilityWarningCode;
  message: string;
};

export type CapabilityReport = {
  backend: {
    requested: BackendPreference;
    active: ActiveBackendKind;
    nativeAvailable: boolean;
  };
  input: {
    pointerEvents: boolean;
    pointerCapture: boolean;
    wheel: boolean;
    touch: boolean;
    keyboard: true;
    ime: true;
  };
  rendering: {
    webgl: boolean;
    requiresUv: true;
  };
  warnings: readonly CapabilityWarning[];
};

export type CapabilityReportInput = {
  requested: BackendPreference;
  active: ActiveBackendKind;
  nativeAvailable: boolean;
  pointerEvents: boolean;
  pointerCapture: boolean;
  touch: boolean;
  webgl: boolean;
};

export function createCapabilityReport(
  input: CapabilityReportInput,
): CapabilityReport {
  const warnings: CapabilityWarning[] = [];

  if (input.requested === 'native' && !input.nativeAvailable) {
    warnings.push({
      code: 'native-backend-unavailable',
      message: 'native HTML-in-Canvasを利用できないためpolyfillを使用します。',
    });
  }
  if (input.active === 'native') {
    warnings.push({
      code: 'native-backend-experimental',
      message: 'native HTML-in-Canvas Backendは実験機能です。',
    });
  }
  if (!input.pointerCapture) {
    warnings.push({
      code: 'pointer-capture-unavailable',
      message: 'Pointer Captureを利用できません。',
    });
  }
  if (!input.touch) {
    warnings.push({
      code: 'touch-unavailable',
      message: 'Touch PointerEventを検出できません。',
    });
  }

  return {
    backend: {
      requested: input.requested,
      active: input.active,
      nativeAvailable: input.nativeAvailable,
    },
    input: {
      pointerEvents: input.pointerEvents,
      pointerCapture: input.pointerCapture,
      wheel: true,
      touch: input.touch,
      keyboard: true,
      ime: true,
    },
    rendering: {
      webgl: input.webgl,
      requiresUv: true,
    },
    warnings,
  };
}
