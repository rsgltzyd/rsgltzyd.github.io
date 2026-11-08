/**
 * Keys stay on the canvas. Direction buttons and real touch pointers
 * are separate. Touch UI is on when any of these is true:
 * primary coarse without hover, any-pointer:coarse, maxTouchPoints,
 * or a real touch pointer event. A fine primary pointer does not hide
 * a mixed device.
 */

import type { Direction, Input } from './types';

export interface InputHooks {
  frame: HTMLElement;
  surface: HTMLElement;
  controlKind: () => 'drag-x' | 'swipe';
  onInput: (input: Input) => void;
  onPrimary: () => void;
  onLeave: () => void;
}

const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
};

export function watchTouchControls(doc: Document): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  let sawTouch = false;

  const media = (query: string): MediaQueryList | null => {
    try {
      return view.matchMedia(query);
    } catch {
      return null;
    }
  };

  const queries = [
    media('(hover: none) and (pointer: coarse)'),
    media('(any-pointer: coarse)'),
    media('(pointer: coarse)'),
  ].filter((item): item is MediaQueryList => item !== null);

  const update = () => {
    const primaryCoarse = queries[0]?.matches === true;
    const anyCoarse = media('(any-pointer: coarse)')?.matches === true;
    const points = (view.navigator?.maxTouchPoints ?? 0) > 0;
    const on = primaryCoarse || anyCoarse || points || sawTouch;
    doc.documentElement.dataset.touchControls = on ? 'on' : 'off';
  };

  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    sawTouch = true;
    update();
  };

  queries.forEach((query) => query.addEventListener('change', update));
  view.addEventListener('pointerdown', onPointer, true);
  update();

  return () => {
    queries.forEach((query) => query.removeEventListener('change', update));
    view.removeEventListener('pointerdown', onPointer, true);
  };
}

export function bindInput(hooks: InputHooks): () => void {
  const { frame, surface, onInput, onPrimary, onLeave } = hooks;
  const view = frame.ownerDocument.defaultView;
  if (!view) return () => {};
  const heldKeys = new Set<Direction>();
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragged = false;
  let swiped = false;

  const emitAxis = () => {
    if (hooks.controlKind() !== 'drag-x') return;
    if (heldKeys.has('left') && !heldKeys.has('right')) onInput({ kind: 'direction', direction: 'left', held: true });
    else if (heldKeys.has('right') && !heldKeys.has('left')) onInput({ kind: 'direction', direction: 'right', held: true });
    else onInput({ kind: 'release' });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== surface) return;
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) onPrimary();
      return;
    }
    const direction = ARROWS[event.key];
    if (!direction) return;
    event.preventDefault();
    if (hooks.controlKind() === 'swipe') {
      if (!event.repeat) onInput({ kind: 'direction', direction, held: false });
      return;
    }
    heldKeys.add(direction);
    emitAxis();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const direction = ARROWS[event.key];
    if (!direction) return;
    heldKeys.delete(direction);
    if (frame.contains(frame.ownerDocument.activeElement) && hooks.controlKind() === 'drag-x') emitAxis();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch') frame.ownerDocument.documentElement.dataset.touchControls = 'on';
    surface.focus();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragged = false;
    swiped = false;
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      pointerId = event.pointerId;
    }
    if (hooks.controlKind() === 'drag-x') {
      const point = pointOf(event);
      if (point) onInput({ kind: 'point', x: point.x, y: point.y });
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) dragged = true;
    if (hooks.controlKind() === 'swipe' && !swiped) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) >= 20) {
        swiped = true;
        const direction: Direction = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up');
        onInput({ kind: 'direction', direction, held: false });
      }
    }
    if (hooks.controlKind() !== 'drag-x') return;
    const point = pointOf(event);
    if (point) onInput({ kind: 'point', x: point.x, y: point.y });
  };

  const finishPointer = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (hooks.controlKind() === 'swipe' && !swiped && dragged) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) >= 16) {
        const direction: Direction = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up');
        onInput({ kind: 'direction', direction, held: false });
      }
    }
    if (hooks.controlKind() === 'drag-x') onInput({ kind: 'release' });
  };

  const onPadDown = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-dir]');
    if (!(button instanceof HTMLButtonElement) || !frame.contains(button)) return;
    if (event.pointerType === 'touch') frame.ownerDocument.documentElement.dataset.touchControls = 'on';
    event.preventDefault();
    const direction = button.dataset.dir as Direction;
    const held = hooks.controlKind() === 'drag-x';
    onInput({ kind: 'direction', direction, held });
    if (held) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        /* capture is optional */
      }
    }
  };

  const onPadUp = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-dir]');
    if (!(button instanceof HTMLButtonElement) || !frame.contains(button)) return;
    if (hooks.controlKind() === 'drag-x') onInput({ kind: 'release' });
  };

  const leave = () => {
    heldKeys.clear();
    pointerId = null;
    onInput({ kind: 'release' });
    onLeave();
  };

  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && frame.contains(next)) return;
    leave();
  };

  const onBlur = () => leave();
  const onHide = () => {
    if (frame.ownerDocument.hidden) leave();
  };

  function pointOf(event: PointerEvent): { x: number; y: number } | null {
    const rect = surface.getBoundingClientRect();
    if (rect.width < 2) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  surface.addEventListener('keydown', onKeyDown);
  view.addEventListener('keyup', onKeyUp);
  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', finishPointer);
  surface.addEventListener('pointercancel', finishPointer);
  surface.addEventListener('lostpointercapture', finishPointer);
  frame.addEventListener('pointerdown', onPadDown);
  frame.addEventListener('pointerup', onPadUp);
  frame.addEventListener('pointercancel', onPadUp);
  frame.addEventListener('focusout', onFocusOut);
  view.addEventListener('blur', onBlur);
  frame.ownerDocument.addEventListener('visibilitychange', onHide);

  return () => {
    surface.removeEventListener('keydown', onKeyDown);
    view.removeEventListener('keyup', onKeyUp);
    surface.removeEventListener('pointerdown', onPointerDown);
    surface.removeEventListener('pointermove', onPointerMove);
    surface.removeEventListener('pointerup', finishPointer);
    surface.removeEventListener('pointercancel', finishPointer);
    surface.removeEventListener('lostpointercapture', finishPointer);
    frame.removeEventListener('pointerdown', onPadDown);
    frame.removeEventListener('pointerup', onPadUp);
    frame.removeEventListener('pointercancel', onPadUp);
    frame.removeEventListener('focusout', onFocusOut);
    view.removeEventListener('blur', onBlur);
    frame.ownerDocument.removeEventListener('visibilitychange', onHide);
  };
}
