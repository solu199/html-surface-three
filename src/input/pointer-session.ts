export type PointerSession<Surface> = {
  pointerId: number;
  pointerType: string;
  surface: Surface;
  target: Element;
  source: 'canvas' | 'dom';
  captured: boolean;
};

export class PointerSessionStore<Surface> {
  private readonly sessions = new Map<number, PointerSession<Surface>>();

  start(
    input: Omit<PointerSession<Surface>, 'captured'>,
  ): PointerSession<Surface> {
    const session = {
      ...input,
      captured: false,
    };
    this.sessions.set(input.pointerId, session);
    return session;
  }

  get(pointerId: number): PointerSession<Surface> | undefined {
    return this.sessions.get(pointerId);
  }

  setCaptured(pointerId: number, captured: boolean): void {
    const session = this.sessions.get(pointerId);
    if (session) {
      session.captured = captured;
    }
  }

  finish(pointerId: number): PointerSession<Surface> | undefined {
    const session = this.sessions.get(pointerId);
    this.sessions.delete(pointerId);
    return session;
  }

  cancelSurface(surface: Surface): PointerSession<Surface>[] {
    const removed = this.values().filter(
      (session) => session.surface === surface,
    );
    for (const session of removed) {
      this.sessions.delete(session.pointerId);
    }
    return removed;
  }

  clear(): PointerSession<Surface>[] {
    const removed = this.values();
    this.sessions.clear();
    return removed;
  }

  values(): PointerSession<Surface>[] {
    return [...this.sessions.values()];
  }
}
