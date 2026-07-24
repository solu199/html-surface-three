type AddListenerOptions = boolean | AddEventListenerOptions | undefined;
type RemoveListenerOptions = boolean | EventListenerOptions | undefined;
type Listener = EventListenerOrEventListenerObject;

const activationCounts = new WeakMap<EventTarget, number>();
const guardedCanvases = new WeakSet<HTMLCanvasElement>();
const listenerWrappers = new WeakMap<
  HTMLCanvasElement,
  WeakMap<Listener, Map<boolean, EventListener>>
>();

function captureOf(
  options: AddListenerOptions | RemoveListenerOptions,
): boolean {
  return typeof options === 'boolean'
    ? options
    : options?.capture ?? false;
}

function shouldSkipListener(event: Event): boolean {
  return (
    event.type === 'click'
    && event.target !== null
    && (activationCounts.get(event.target) ?? 0) > 0
  );
}

function getListenerWrapper(
  canvas: HTMLCanvasElement,
  listener: Listener,
  capture: boolean,
): EventListener {
  let byListener = listenerWrappers.get(canvas);
  if (!byListener) {
    byListener = new WeakMap();
    listenerWrappers.set(canvas, byListener);
  }

  let byCapture = byListener.get(listener);
  if (!byCapture) {
    byCapture = new Map();
    byListener.set(listener, byCapture);
  }

  let wrapper = byCapture.get(capture);
  if (!wrapper) {
    wrapper = function guardedCanvasClickListener(
      this: HTMLCanvasElement,
      event: Event,
    ) {
      if (shouldSkipListener(event)) {
        return;
      }

      if (typeof listener === 'function') {
        listener.call(this, event);
      } else {
        listener.handleEvent(event);
      }
    };
    byCapture.set(capture, wrapper);
  }

  return wrapper;
}

export function installCanvasActivationGuard(
  canvas: HTMLCanvasElement,
): boolean {
  if (guardedCanvases.has(canvas)) {
    return false;
  }

  const add = canvas.addEventListener.bind(canvas);
  const remove = canvas.removeEventListener.bind(canvas);

  Object.defineProperties(canvas, {
    addEventListener: {
      configurable: true,
      writable: true,
      value(
        type: string,
        listener: Listener | null,
        options?: AddListenerOptions,
      ) {
        if (!listener) {
          return;
        }
        const guardedListener = type === 'click'
          ? getListenerWrapper(canvas, listener, captureOf(options))
          : listener;
        add(type, guardedListener, options);
      },
    },
    removeEventListener: {
      configurable: true,
      writable: true,
      value(
        type: string,
        listener: Listener | null,
        options?: RemoveListenerOptions,
      ) {
        if (!listener) {
          return;
        }
        const guardedListener = (
          type === 'click'
          && listenerWrappers
            .get(canvas)
            ?.get(listener)
            ?.get(captureOf(options))
        ) || listener;
        remove(type, guardedListener, options);
      },
    },
  });

  guardedCanvases.add(canvas);
  return true;
}

export function runWithDomActivation<T>(
  target: Element,
  activate: () => T,
): T {
  activationCounts.set(
    target,
    (activationCounts.get(target) ?? 0) + 1,
  );

  try {
    return activate();
  } finally {
    const remaining = (activationCounts.get(target) ?? 1) - 1;
    if (remaining === 0) {
      activationCounts.delete(target);
    } else {
      activationCounts.set(target, remaining);
    }
  }
}
