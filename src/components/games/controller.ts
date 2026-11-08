/**
 * One active game. Theme changes call setTheme and render only.
 * Switching games destroys the previous instance.
 */

import { readPalette } from './canvas';
import { bindFullscreen, type ScreenMode } from './fullscreen';
import { bindInput, watchTouchControls } from './input';
import { createBreakout } from './breakout';
import { createGame2048 } from './game2048';
import { createRain } from './rain';
import { createSnake } from './snake';
import type { ControlKind, Game, Phase } from './types';

export interface GameEntry {
  id: string;
  label: string;
  hint: string;
  kind: ControlKind;
  create: () => Game;
}

export const GAME_LIST: GameEntry[] = [
  {
    id: 'rain',
    label: '雨中躲线',
    hint: '雨中躲线。左右或 A D 移动，空格开始或暂停。',
    kind: 'drag-x',
    create: createRain,
  },
  {
    id: 'snake',
    label: '贪吃蛇',
    hint: '贪吃蛇。方向键或滑动转向，空格开始或暂停。',
    kind: 'swipe',
    create: createSnake,
  },
  {
    id: 'breakout',
    label: '打砖块',
    hint: '打砖块。左右或 A D 移动挡板，空格开始或暂停。三命。',
    kind: 'drag-x',
    create: createBreakout,
  },
  {
    id: '2048',
    label: '2048',
    hint: '2048。方向键或滑动移动，空格开始或暂停。暂停时不接受移动。',
    kind: 'swipe',
    create: createGame2048,
  },
];

const PHASE_LABEL: Record<Phase, string> = {
  idle: '待机',
  playing: '游玩',
  paused: '暂停',
  over: '结束',
  won: '过关',
};

const mounts = new WeakMap<HTMLElement, () => void>();

export function initGameDeck(frame: HTMLElement): () => void {
  const previous = mounts.get(frame);
  if (previous) previous();

  const doc = frame.ownerDocument;
  const view = doc.defaultView;
  const canvas = frame.querySelector('[data-game-canvas]');
  const readout = frame.querySelector('[data-game-readout]');
  const live = frame.querySelector('[data-game-live]');
  const toggle = frame.querySelector('[data-game-action="toggle"]');
  const resetButton = frame.querySelector('[data-game-action="reset"]');
  const fullButton = frame.querySelector('[data-game-action="fullscreen"]');
  const fullLabel = frame.querySelector('[data-game-fullscreen-label]');
  if (
    !view ||
    !(canvas instanceof HTMLCanvasElement) ||
    !readout ||
    !live ||
    !(toggle instanceof HTMLButtonElement) ||
    !(resetButton instanceof HTMLButtonElement) ||
    !(fullButton instanceof HTMLButtonElement) ||
    !(fullLabel instanceof HTMLElement)
  ) {
    return () => {};
  }

  if (canvas.getContext('2d') === null) {
    readout.textContent = '画面不可用。页面上的文章仍然可以阅读。';
    return () => {};
  }

  let active: Game | null = null;
  let current = GAME_LIST[0];
  let phase: Phase = 'idle';
  let announced = '';

  const palette = () => readPalette(doc.documentElement);

  const paintButtons = () => {
    frame.querySelectorAll('button[data-game]').forEach((button) => {
      button.setAttribute('aria-pressed', button.getAttribute('data-game') === current.id ? 'true' : 'false');
    });
    canvas.setAttribute('aria-label', current.hint);
    if (phase === 'playing') toggle.textContent = '暂停';
    else if (phase === 'paused') toggle.textContent = '继续';
    else toggle.textContent = '开始';
  };

  const mount = (entry: GameEntry) => {
    active?.pause();
    active?.destroy();
    current = entry;
    active = entry.create();
    phase = 'idle';
    active.init({
      canvas,
      palette: palette(),
      random: Math.random,
      onState: (state) => {
        phase = state.phase;
        const lives = state.lives === null ? '' : ` · 生命 ${state.lives}`;
        readout.textContent = `${current.label} · ${PHASE_LABEL[state.phase]} · ${state.score}${lives}`;
        paintButtons();
        if ((state.phase === 'over' || state.phase === 'won') && announced !== `${current.id}:${state.phase}:${state.score}`) {
          announced = `${current.id}:${state.phase}:${state.score}`;
          live.textContent = state.phase === 'won' ? `${current.label}过关` : `${current.label}结束`;
        }
        if (state.phase === 'playing' || state.phase === 'idle') announced = '';
      },
    });
    paintButtons();
  };

  const onToggle = () => {
    if (!active) return;
    if (phase === 'idle') active.start();
    else if (phase === 'playing') active.pause();
    else if (phase === 'paused') active.resume();
    else active.reset();
  };

  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const pick = target.closest('button[data-game]');
    if (pick instanceof HTMLButtonElement && frame.contains(pick)) {
      const id = pick.getAttribute('data-game');
      const entry = GAME_LIST.find((item) => item.id === id);
      if (!entry || entry.id === current.id) return;
      mount(entry);
    }
  };

  const onTheme = () => {
    if (!active) return;
    active.setTheme(palette());
    active.render();
  };

  const onResize = () => active?.resize();

  const stopTouch = watchTouchControls(doc);
  const stopInput = bindInput({
    frame,
    surface: canvas,
    controlKind: () => current.kind,
    onInput: (input) => active?.input(input),
    onPrimary: onToggle,
    onLeave: () => {
      if (phase === 'playing') active?.pause();
    },
  });
  const stopFull = bindFullscreen({
    frame,
    button: fullButton,
    label: fullLabel,
    onChange: (_mode: ScreenMode) => active?.resize(),
  });

  const onReset = () => active?.reset();
  toggle.addEventListener('click', onToggle);
  resetButton.addEventListener('click', onReset);
  frame.addEventListener('click', onClick);
  doc.documentElement.addEventListener('themechange', onTheme);
  view.addEventListener('resize', onResize);
  const observer = new ResizeObserver(() => active?.resize());
  observer.observe(canvas);

  mount(current);

  const cleanup = () => {
    active?.destroy();
    active = null;
    stopTouch();
    stopInput();
    stopFull();
    toggle.removeEventListener('click', onToggle);
    resetButton.removeEventListener('click', onReset);
    frame.removeEventListener('click', onClick);
    doc.documentElement.removeEventListener('themechange', onTheme);
    view.removeEventListener('resize', onResize);
    observer.disconnect();
    if (mounts.get(frame) === cleanup) mounts.delete(frame);
  };
  mounts.set(frame, cleanup);
  view.addEventListener('pagehide', cleanup, { once: true });
  return cleanup;
}
