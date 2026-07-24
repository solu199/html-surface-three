const syntheticPointerEvents = new WeakSet<Event>();

export function resolveDomTarget(
  root: HTMLElement,
  clientX: number,
  clientY: number,
): Element | undefined {
  const target = document.elementFromPoint(clientX, clientY);
  return target && root.contains(target)
    ? target
    : undefined;
}

export function focusDomTarget(target: Element): void {
  if (target instanceof HTMLElement) {
    target.focus({ preventScroll: true });
  }
}

export function dispatchPointerClone(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  source: PointerEvent,
): boolean {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: source.pointerId,
    pointerType: source.pointerType,
    isPrimary: source.isPrimary,
    clientX: source.clientX,
    clientY: source.clientY,
    screenX: source.screenX,
    screenY: source.screenY,
    button: source.button,
    buttons: source.buttons,
    pressure: source.pressure,
    tangentialPressure: source.tangentialPressure,
    tiltX: source.tiltX,
    tiltY: source.tiltY,
    twist: source.twist,
    width: source.width,
    height: source.height,
    ctrlKey: source.ctrlKey,
    shiftKey: source.shiftKey,
    altKey: source.altKey,
    metaKey: source.metaKey,
  });
  syntheticPointerEvents.add(event);
  return target.dispatchEvent(event);
}

export function isSyntheticPointerEvent(event: Event): boolean {
  return syntheticPointerEvents.has(event);
}

export function activateDomTarget(target: Element): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (
    (
      target instanceof HTMLButtonElement
      || target instanceof HTMLInputElement
      || target instanceof HTMLSelectElement
      || target instanceof HTMLTextAreaElement
    )
    && target.disabled
  ) {
    return false;
  }

  target.click();
  return true;
}
