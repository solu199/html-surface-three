import {
  activateDomTarget,
  dispatchPointerClone,
  focusDomTarget,
  isSyntheticPointerEvent,
  resolveDomTarget,
} from './dom-target';
import {
  PointerSessionStore,
  type PointerSession,
} from './pointer-session';
import {
  applyWheelDelta,
  findScrollableTarget,
} from './scroll-routing';

export type InputSurface = {
  readonly id: string;
  readonly element: HTMLElement;
  readonly enabled: boolean;
  invalidate(): void;
};

export type RoutedSurfaceHit = {
  surface: InputSurface;
  domPoint: {
    x: number;
    y: number;
  };
};

export type InputDebugState = {
  surfaceId?: string;
  focusTarget?: string;
  capturedPointerId?: number;
};

export type DomInputRouterOptions = {
  canvas: HTMLCanvasElement;
  routePoint(
    clientX: number,
    clientY: number,
  ): RoutedSurfaceHit | undefined;
  onDebugChange?: (state: InputDebugState) => void;
};

function describeElement(element: Element | null): string | undefined {
  if (!element) {
    return undefined;
  }
  const id = element.id ? `#${element.id}` : '';
  const testId = element.getAttribute('data-testid');
  const testPart = testId ? `[data-testid="${testId}"]` : '';
  return `${element.tagName.toLowerCase()}${id}${testPart}`;
}

export class DomInputRouter {
  private readonly sessions = new PointerSessionStore<InputSurface>();
  private readonly surfaces = new Set<InputSurface>();
  private readonly surfaceCleanup = new Map<
    InputSurface,
    Array<() => void>
  >();
  private readonly canvasCleanup: Array<() => void> = [];

  private activeSurface: InputSurface | undefined;
  private focusedSurface: InputSurface | undefined;
  private lastPointer:
    | { clientX: number; clientY: number }
    | undefined;
  private debugState: InputDebugState = {};
  private disposed = false;

  constructor(private readonly options: DomInputRouterOptions) {
    this.connectCanvasEvents();
  }

  registerSurface(surface: InputSurface): void {
    if (this.disposed || this.surfaces.has(surface)) {
      return;
    }

    this.surfaces.add(surface);
    surface.element.inert = true;
    const cleanup: Array<() => void> = [];

    const listen = <EventType extends Event>(
      type: string,
      handler: (event: EventType) => void,
      options?: AddEventListenerOptions | boolean,
    ) => {
      const listener = handler as EventListener;
      surface.element.addEventListener(type, listener, options);
      cleanup.push(() => {
        surface.element.removeEventListener(type, listener, options);
      });
    };

    listen<PointerEvent>('pointerdown', (event) => {
      if (isSyntheticPointerEvent(event)) {
        return;
      }
      this.rememberPointer(event);
      const hit = this.options.routePoint(event.clientX, event.clientY);
      if (hit?.surface !== surface || !surface.enabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const target = event.target instanceof Element
        ? event.target
        : surface.element;
      const session = this.sessions.start({
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        surface,
        target,
        source: 'dom',
      });
      this.activeSurface = surface;
      this.tryCapture(target, event.pointerId, session);
      this.syncInertState();
      this.publishDebug();
    }, true);

    listen<PointerEvent>('pointermove', (event) => {
      if (isSyntheticPointerEvent(event)) {
        return;
      }
      this.rememberPointer(event);
      const session = this.sessions.get(event.pointerId);
      if (session?.source === 'dom' && session.captured) {
        this.publishDebug();
        return;
      }
      const hit = this.options.routePoint(event.clientX, event.clientY);
      if (hit?.surface !== surface || !surface.enabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.activeSurface = undefined;
      } else {
        this.activeSurface = surface;
      }
      this.syncInertState();
      this.publishDebug();
    }, true);

    listen<PointerEvent>('pointerup', (event) => {
      if (isSyntheticPointerEvent(event)) {
        return;
      }
      this.rememberPointer(event);
      const session = this.sessions.get(event.pointerId);
      if (!session || session.surface !== surface) {
        return;
      }
      if (!session.captured) {
        const hit = this.options.routePoint(event.clientX, event.clientY);
        if (hit?.surface !== surface) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
      this.sessions.finish(event.pointerId);
      surface.invalidate();
      this.syncInertState();
      this.publishDebug();
    }, true);

    listen<PointerEvent>('pointercancel', (event) => {
      if (isSyntheticPointerEvent(event)) {
        return;
      }
      const session = this.sessions.get(event.pointerId);
      if (session?.surface === surface) {
        this.sessions.finish(event.pointerId);
        this.syncInertState();
        this.publishDebug();
      }
    }, true);

    listen<PointerEvent>('gotpointercapture', (event) => {
      if (!isSyntheticPointerEvent(event)) {
        this.sessions.setCaptured(event.pointerId, true);
        this.publishDebug();
      }
    }, true);

    listen<PointerEvent>('lostpointercapture', (event) => {
      if (!isSyntheticPointerEvent(event)) {
        this.sessions.setCaptured(event.pointerId, false);
        this.publishDebug();
      }
    }, true);

    listen<WheelEvent>('wheel', (event) => {
      const hit = this.options.routePoint(event.clientX, event.clientY);
      if (hit?.surface !== surface || !surface.enabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.stopPropagation();
      queueMicrotask(surface.invalidate);
    }, {
      capture: true,
      passive: false,
    });

    listen<FocusEvent>('focusin', () => {
      this.focusedSurface = surface;
      this.syncInertState();
      this.publishDebug();
    }, true);

    listen<FocusEvent>('focusout', () => {
      queueMicrotask(() => {
        if (!surface.element.contains(document.activeElement)) {
          if (this.focusedSurface === surface) {
            this.focusedSurface = undefined;
          }
          this.syncInertState();
          this.publishDebug();
        }
      });
    }, true);

    for (const eventName of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'click',
      'dblclick',
      'contextmenu',
      'wheel',
    ]) {
      listen<Event>(eventName, (event) => {
        event.stopPropagation();
      });
    }

    this.surfaceCleanup.set(surface, cleanup);
    this.syncInertState();
  }

  unregisterSurface(surface: InputSurface): void {
    if (!this.surfaces.has(surface)) {
      return;
    }

    for (const session of this.sessions.cancelSurface(surface)) {
      dispatchPointerClone(
        session.target,
        'pointercancel',
        this.createPointerEvent(session),
      );
      this.releaseCapture(session);
    }
    for (const cleanup of this.surfaceCleanup.get(surface) ?? []) {
      cleanup();
    }
    this.surfaceCleanup.delete(surface);
    this.surfaces.delete(surface);
    surface.element.inert = true;
    if (this.activeSurface === surface) {
      this.activeSurface = undefined;
    }
    if (this.focusedSurface === surface) {
      this.focusedSurface = undefined;
    }
    this.syncInertState();
    this.publishDebug();
  }

  syncSurface(surface: InputSurface): void {
    if (!surface.enabled) {
      for (const session of this.sessions.cancelSurface(surface)) {
        dispatchPointerClone(
          session.target,
          'pointercancel',
          this.createPointerEvent(session),
        );
        this.releaseCapture(session);
      }
      if (this.activeSurface === surface) {
        this.activeSurface = undefined;
      }
    }
    this.syncInertState();
    this.publishDebug();
  }

  update(): void {
    if (
      this.disposed
      || !this.lastPointer
      || this.sessions.values().some((session) => session.captured)
    ) {
      return;
    }
    this.routeAndActivate(
      this.lastPointer.clientX,
      this.lastPointer.clientY,
    );
  }

  getDebugState(): InputDebugState {
    return { ...this.debugState };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const surface of [...this.surfaces]) {
      this.unregisterSurface(surface);
    }
    for (const cleanup of this.canvasCleanup.splice(0)) {
      cleanup();
    }
    for (const session of this.sessions.clear()) {
      this.releaseCapture(session);
    }
    this.activeSurface = undefined;
    this.focusedSurface = undefined;
    this.disposed = true;
    this.publishDebug();
  }

  private connectCanvasEvents(): void {
    const canvas = this.options.canvas;

    const onPointerMove = (event: PointerEvent) => {
      if (
        isSyntheticPointerEvent(event)
        || this.isSurfaceEventTarget(event.target)
      ) {
        return;
      }
      this.rememberPointer(event);
      const session = this.sessions.get(event.pointerId);
      if (session?.source === 'canvas') {
        event.preventDefault();
        event.stopImmediatePropagation();
        dispatchPointerClone(session.target, 'pointermove', event);
        this.publishDebug();
        return;
      }
      this.routeAndActivate(event.clientX, event.clientY);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (
        isSyntheticPointerEvent(event)
        || this.isSurfaceEventTarget(event.target)
      ) {
        return;
      }
      this.rememberPointer(event);
      const hit = this.routeAndActivate(event.clientX, event.clientY);
      if (!hit?.surface.enabled) {
        return;
      }
      const target = resolveDomTarget(
        hit.surface.element,
        event.clientX,
        event.clientY,
      );
      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      focusDomTarget(target);
      const session = this.sessions.start({
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        surface: hit.surface,
        target,
        source: 'canvas',
      });
      dispatchPointerClone(target, 'pointerdown', event);
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Canvas capture is emulated by the session when unavailable.
      }
      session.captured = true;
      this.syncInertState();
      this.publishDebug();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (
        isSyntheticPointerEvent(event)
        || this.isSurfaceEventTarget(event.target)
      ) {
        return;
      }
      this.rememberPointer(event);
      const session = this.sessions.get(event.pointerId);
      if (session?.source !== 'canvas') {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      dispatchPointerClone(session.target, 'pointerup', event);
      activateDomTarget(session.target);
      this.sessions.finish(event.pointerId);
      this.releaseCapture(session);
      session.surface.invalidate();
      this.syncInertState();
      this.publishDebug();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (
        isSyntheticPointerEvent(event)
        || this.isSurfaceEventTarget(event.target)
      ) {
        return;
      }
      const session = this.sessions.get(event.pointerId);
      if (session?.source !== 'canvas') {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      dispatchPointerClone(session.target, 'pointercancel', event);
      this.sessions.finish(event.pointerId);
      this.releaseCapture(session);
      this.syncInertState();
      this.publishDebug();
    };

    const onWheel = (event: WheelEvent) => {
      if (this.isSurfaceEventTarget(event.target)) {
        return;
      }
      this.lastPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      const hit = this.routeAndActivate(event.clientX, event.clientY);
      if (!hit) {
        return;
      }
      const target = resolveDomTarget(
        hit.surface.element,
        event.clientX,
        event.clientY,
      );
      if (!target) {
        return;
      }
      const scrollable = findScrollableTarget(
        hit.surface.element,
        target,
        event.deltaY,
      );
      if (!scrollable || !applyWheelDelta(scrollable, event.deltaY)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      hit.surface.invalidate();
    };

    canvas.addEventListener('pointermove', onPointerMove, true);
    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('pointerup', onPointerUp, true);
    canvas.addEventListener('pointercancel', onPointerCancel, true);
    canvas.addEventListener('wheel', onWheel, {
      capture: true,
      passive: false,
    });
    this.canvasCleanup.push(
      () => canvas.removeEventListener('pointermove', onPointerMove, true),
      () => canvas.removeEventListener('pointerdown', onPointerDown, true),
      () => canvas.removeEventListener('pointerup', onPointerUp, true),
      () => canvas.removeEventListener('pointercancel', onPointerCancel, true),
      () => canvas.removeEventListener('wheel', onWheel, true),
    );
  }

  private isSurfaceEventTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) {
      return false;
    }

    return [...this.surfaces].some((surface) => (
      surface.element.contains(target)
    ));
  }

  private routeAndActivate(
    clientX: number,
    clientY: number,
  ): RoutedSurfaceHit | undefined {
    const hit = this.options.routePoint(clientX, clientY);
    this.activeSurface = hit?.surface.enabled
      ? hit.surface
      : undefined;
    this.syncInertState();
    this.publishDebug();
    return hit?.surface.enabled ? hit : undefined;
  }

  private rememberPointer(event: PointerEvent): void {
    this.lastPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  private tryCapture(
    target: Element,
    pointerId: number,
    session: PointerSession<InputSurface>,
  ): void {
    try {
      target.setPointerCapture(pointerId);
      session.captured = true;
    } catch {
      session.captured = false;
    }
  }

  private releaseCapture(session: PointerSession<InputSurface>): void {
    const captureTarget = session.source === 'canvas'
      ? this.options.canvas
      : session.target;
    try {
      if (captureTarget.hasPointerCapture(session.pointerId)) {
        captureTarget.releasePointerCapture(session.pointerId);
      }
    } catch {
      // Releasing an already-lost capture is safe.
    }
    session.captured = false;
  }

  private createPointerEvent(
    session: PointerSession<InputSurface>,
  ): PointerEvent {
    return new PointerEvent('pointercancel', {
      pointerId: session.pointerId,
      pointerType: session.pointerType,
      bubbles: true,
      cancelable: true,
    });
  }

  private syncInertState(): void {
    const sessionSurfaces = new Set(
      this.sessions.values().map((session) => session.surface),
    );
    for (const surface of this.surfaces) {
      surface.element.inert = (
        !surface.enabled
        || (
          surface !== this.activeSurface
          && surface !== this.focusedSurface
          && !sessionSurfaces.has(surface)
        )
      );
    }
  }

  private publishDebug(): void {
    const captured = this.sessions.values().find(
      (session) => session.captured,
    );
    this.debugState = {
      surfaceId: this.activeSurface?.id ?? this.focusedSurface?.id,
      focusTarget: describeElement(document.activeElement),
      capturedPointerId: captured?.pointerId,
    };
    this.options.onDebugChange?.(this.getDebugState());
  }
}
