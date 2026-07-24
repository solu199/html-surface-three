function canScroll(
  element: HTMLElement,
  deltaY: number,
): boolean {
  const style = getComputedStyle(element);
  if (!['auto', 'scroll'].includes(style.overflowY)) {
    return false;
  }

  const maximum = element.scrollHeight - element.clientHeight;
  if (maximum <= 0 || deltaY === 0) {
    return false;
  }

  return deltaY < 0
    ? element.scrollTop > 0
    : element.scrollTop < maximum;
}

export function findScrollableTarget(
  root: HTMLElement,
  start: Element,
  deltaY: number,
): HTMLElement | undefined {
  let current: Element | null = start;
  while (current && root.contains(current)) {
    if (
      current instanceof HTMLElement
      && canScroll(current, deltaY)
    ) {
      return current;
    }
    if (current === root) {
      break;
    }
    current = current.parentElement;
  }

  return undefined;
}

export function applyWheelDelta(
  element: HTMLElement,
  deltaY: number,
): boolean {
  const before = element.scrollTop;
  const maximum = Math.max(
    0,
    element.scrollHeight - element.clientHeight,
  );
  element.scrollTop = Math.min(
    maximum,
    Math.max(0, before + deltaY),
  );
  return element.scrollTop !== before;
}
