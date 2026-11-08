/**
 * GameDeck controller.
 * Manages active game, score formatting, fullscreen, and touch controls.
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
  aspectHeight: number;
  create: () => Game;
}

export const GAME_LIST: GameEntry[] = [
  {
    id: 'rain',
    label: '雨中躲线',
    hint: '雨中躲线。左右或 A D 移动，空格开始或暂停。',
    kind: 'drag-x',
    aspectHeight: 200,
    create: createRain,
  },
  {
    id: 'snake',
    label: '贪吃蛇',
    hint: '贪吃蛇。方向键或滑动转向，空格开始或暂停。',
    kind: 'swipe',
    aspectHeight: 240,
    create: createSnake,
  },
  {
    id: 'breakout',
    label: '打砖块',
    hint: '打砖块。左右或 A D 移动挡板，空格开始或暂停。三命。',
    kind: 'drag-x',
    aspectHeight: 240,
    create: createBreakout,
  },
  {
    id: '2048',
    label: '2048',
    hint: '2048。方向键或滑动移动，空格开始或暂停。',
    kind: 'swipe',
    aspectHeight: 240,
    create: createGame2048,
  },
];

const bestScores: Record<string, number> = {
  rain: 0,
  snake: 0,
  breakout: 0,
  '2048': 0,
};

const mounts = new WeakMap<HTMLElement, () => void>();

export function initGameDeck(frame: HTMLElement): () => void {
  const previous = mounts.get(frame);
  if (previous) previous();

  const doc = frame.ownerDocument;
  const view = doc.defaultView;
  const canvas = frame.querySelector<HTMLCanvasElement>('[data-game-canvas]');
  const stage = frame.querySelector<HTMLElement>('[data-game-stage]');
  const scoreEl = frame.querySelector<HTMLElement>('[data-game-score]');
  const bestEl = frame.querySelector<HTMLElement>('[data-game-best]');
  const toggle = frame.querySelector<HTMLButtonElement>('[data-game-action="toggle"]');
  const fullButton = frame.querySelector<HTMLButtonElement>('[data-game-action="fullscreen"]');
  const fullLabel = frame.querySelector<HTMLElement>('[data-game-fullscreen-label]');
  const touchWrap = frame.querySelector<HTMLElement>('[data-game-touch-controls]');
  const deck = frame.closest('[data-game-deck]') || frame;

  if (!view || !canvas || !toggle || !fullButton || !fullLabel || !scoreEl || !bestEl) {
    return () => {};
  }

  let active: Game | null = null;
  let current = GAME_LIST[0];
  let phase: Phase = 'idle';

  const palette = () => readPalette(doc.documentElement);

  const updateTouchButtons = (entry: GameEntry) => {
    if (!touchWrap) return;
    if (entry.kind === 'drag-x') {
      touchWrap.innerHTML = `
        <button type="button" class="game-touch-btn" data-dir="left" aria-label="向左">←</button>
        <button type="button" class="game-touch-btn" data-dir="right" aria-label="向右">→</button>
      `;
    } else {
      touchWrap.innerHTML = `
        <button type="button" class="game-touch-btn" data-dir="left" aria-label="向左">←</button>
        <button type="button" class="game-touch-btn" data-dir="up" aria-label="向上">↑</button>
        <button type="button" class="game-touch-btn" data-dir="down" aria-label="向下">↓</button>
        <button type="button" class="game-touch-btn" data-dir="right" aria-label="向右">→</button>
      `;
    }
  };

  const paintButtons = () => {
    deck.querySelectorAll('button[data-game]').forEach((button) => {
      button.setAttribute('aria-selected', button.getAttribute('data-game') === current.id ? 'true' : 'false');
    });
    canvas.setAttribute('aria-label', current.hint);

    if (phase === 'playing') toggle.textContent = '暂停';
    else if (phase === 'paused') toggle.textContent = '继续';
    else if (phase === 'over') toggle.textContent = '再来一局';
    else if (phase === 'won') toggle.textContent = '过关！';
    else toggle.textContent = '开始';
  };

  const mount = (entry: GameEntry) => {
    active?.pause();
    active?.destroy();
    current = entry;
    active = entry.create();
    phase = 'idle';

    if (stage) {
      stage.classList.toggle('aspect-240', entry.aspectHeight === 240);
    }
    updateTouchButtons(entry);

    scoreEl.textContent = '得分 000';
    bestEl.textContent = `最佳 ${String(bestScores[current.id] || 0).padStart(3, '0')}`;

    active.init({
      canvas,
      palette: palette(),
      random: Math.random,
      onState: (state) => {
        phase = state.phase;
        const currentScore = Math.floor(state.score);
        scoreEl.textContent = `得分 ${String(currentScore).padStart(3, '0')}`;
        if (currentScore > (bestScores[current.id] || 0)) {
          bestScores[current.id] = currentScore;
        }
        bestEl.textContent = `最佳 ${String(bestScores[current.id] || 0).padStart(3, '0')}`;
        paintButtons();
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

  const onTabClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const pick = target.closest('button[data-game]');
    if (pick instanceof HTMLButtonElement) {
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

  toggle.addEventListener('click', onToggle);
  deck.addEventListener('click', onTabClick);
  doc.addEventListener('yl-theme-change', onTheme);
  view.addEventListener('resize', onResize);

  mount(current);

  const cleanup = () => {
    active?.destroy();
    active = null;
    stopTouch();
    stopInput();
    stopFull();
    toggle.removeEventListener('click', onToggle);
    deck.removeEventListener('click', onTabClick);
    doc.removeEventListener('yl-theme-change', onTheme);
    view.removeEventListener('resize', onResize);
    if (mounts.get(frame) === cleanup) mounts.delete(frame);
  };

  mounts.set(frame, cleanup);
  return cleanup;
}
