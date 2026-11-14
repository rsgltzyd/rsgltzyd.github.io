/**
 * Keyboard works anywhere on the game page, not only on the canvas.
 * Direction buttons stay hidden on desktop (fine pointer with hover)
 * unless the player shows them, or a real touch happens.
 * Touch UI is on when the primary pointer is coarse without hover,
 * or a real touch pointer event is seen.
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

const TYPING = 'input, textarea, select, [contenteditable="true"]';
const STICK_DEADZONE = 0.5;
const PAD_A = 0;
const PAD_START = 9;
const PAD_UP = 12;
const PAD_DOWN = 13;
const PAD_LEFT = 14;
const PAD_RIGHT = 15;

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
  ].filter((item): item is MediaQueryList => item !== null);

  const update = () => {
    const primaryTouch = queries[0]?.matches === true;
    const on = primaryTouch || sawTouch;
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

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(TYPING) !== null;
}

function stickDirection(x: number, y: number): Direction | null {
  if (Math.hypot(x, y) < STICK_DEADZONE) return null;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
}

function firstGamepad(view: Window): Gamepad | null {
  const list = view.navigator.getGamepads?.();
  if (!list) return null;
  for (const pad of list) {
    if (pad) return pad;
  }
  return null;
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
  let padHeld: Direction | null = null;
  let stickHeld: Direction | null = null;
  let prevPad = { up: false, down: false, left: false, right: false, primary: false };
  let raf = 0;

  const emitAxis = () => {
    if (hooks.controlKind() !== 'drag-x') return;
    if (heldKeys.has('left') && !heldKeys.has('right')) onInput({ kind: 'direction', direction: 'left', held: true });
    else if (heldKeys.has('right') && !heldKeys.has('left')) onInput({ kind: 'direction', direction: 'right', held: true });
    else onInput({ kind: 'release' });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
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
    if (hooks.controlKind() === 'drag-x') emitAxis();
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

  const emitPoint = (event: PointerEvent) => {
    const point = pointOf(event);
    if (point) onInput({ kind: 'point', x: point.x, y: point.y });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (hooks.controlKind() === 'drag-x') {
      if (pointerId !== null && pointerId !== event.pointerId) return;
      if (pointerId === null && event.pointerType === 'touch') return;
      emitPoint(event);
      return;
    }
    if (pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) dragged = true;
    if (!swiped) {
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
  };

  const onPointerEnter = (event: PointerEvent) => {
    if (hooks.controlKind() !== 'drag-x') return;
    if (event.pointerType === 'touch') return;
    emitPoint(event);
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
    padHeld = null;
    stickHeld = null;
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

  const releasePadAxis = () => {
    if (padHeld !== null) {
      padHeld = null;
      onInput({ kind: 'release' });
    }
  };

  const pollGamepad = () => {
    raf = view.requestAnimationFrame(pollGamepad);
    const pad = firstGamepad(view);
    if (!pad) {
      if (padHeld !== null || stickHeld !== null) {
        stickHeld = null;
        releasePadAxis();
        prevPad = { up: false, down: false, left: false, right: false, primary: false };
      }
      return;
    }

    const pressed = {
      up: !!pad.buttons[PAD_UP]?.pressed,
      down: !!pad.buttons[PAD_DOWN]?.pressed,
      left: !!pad.buttons[PAD_LEFT]?.pressed,
      right: !!pad.buttons[PAD_RIGHT]?.pressed,
      primary: !!pad.buttons[PAD_A]?.pressed || !!pad.buttons[PAD_START]?.pressed,
    };
    const stick = stickDirection(pad.axes[0] ?? 0, pad.axes[1] ?? 0);

    if (pressed.primary && !prevPad.primary) onPrimary();

    if (hooks.controlKind() === 'swipe') {
      const dirs: Direction[] = ['up', 'down', 'left', 'right'];
      for (const dir of dirs) {
        if (pressed[dir] && !prevPad[dir]) onInput({ kind: 'direction', direction: dir, held: false });
      }
      if (stick && stick !== stickHeld) onInput({ kind: 'direction', direction: stick, held: false });
      stickHeld = stick;
    } else {
      const dir: Direction | null = pressed.left && !pressed.right
        ? 'left'
        : pressed.right && !pressed.left
          ? 'right'
          : stick === 'left' || stick === 'right'
            ? stick
            : null;
      if (dir !== padHeld) {
        padHeld = dir;
        if (dir) onInput({ kind: 'direction', direction: dir, held: true });
        else onInput({ kind: 'release' });
      }
    }

    prevPad = pressed;
  };

  view.addEventListener('keydown', onKeyDown, true);
  view.addEventListener('keyup', onKeyUp);
  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerenter', onPointerEnter);
  surface.addEventListener('pointerup', finishPointer);
  surface.addEventListener('pointercancel', finishPointer);
  surface.addEventListener('lostpointercapture', finishPointer);
  frame.addEventListener('pointerdown', onPadDown);
  frame.addEventListener('pointerup', onPadUp);
  frame.addEventListener('pointercancel', onPadUp);
  frame.addEventListener('focusout', onFocusOut);
  view.addEventListener('blur', onBlur);
  frame.ownerDocument.addEventListener('visibilitychange', onHide);
  raf = view.requestAnimationFrame(pollGamepad);

  return () => {
    view.cancelAnimationFrame(raf);
    view.removeEventListener('keydown', onKeyDown, true);
    view.removeEventListener('keyup', onKeyUp);
    surface.removeEventListener('pointerdown', onPointerDown);
    surface.removeEventListener('pointermove', onPointerMove);
    surface.removeEventListener('pointerenter', onPointerEnter);
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
