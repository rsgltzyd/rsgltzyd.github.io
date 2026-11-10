/**
 * One game page. Score, sound, modal, and touch controls for a single id.
 */

import { readPalette } from './canvas';
import { bindFullscreen, type ScreenMode } from './fullscreen';
import { bindInput, watchTouchControls } from './input';
import { playSound, isSoundMuted, toggleSound } from './sound';
import { createBreakout } from './breakout';
import { createGame2048 } from './game2048';
import { createRain } from './rain';
import { createSnake } from './snake';
import type { ControlKind, Game, Phase } from './types';

export interface GameEntry {
  id: string;
  label: string;
  blurb: string;
  hint: string;
  kind: ControlKind;
  aspectHeight: number;
  create: () => Game;
}

export const GAME_LIST: GameEntry[] = [
  {
    id: 'rain',
    label: '雨中躲线',
    blurb: '左右躲开落下的雨线。',
    hint: '雨中躲线。左右或 A D 移动，空格开始或暂停。',
    kind: 'drag-x',
    aspectHeight: 200,
    create: createRain,
  },
  {
    id: 'snake',
    label: '贪吃蛇',
    blurb: '吃到点，别咬到自己。',
    hint: '贪吃蛇。方向键或滑动转向，空格开始或暂停。',
    kind: 'swipe',
    aspectHeight: 240,
    create: createSnake,
  },
  {
    id: 'breakout',
    label: '打砖块',
    blurb: '三命，把砖打光。',
    hint: '打砖块。左右或 A D 移动挡板，空格开始或暂停。三命。',
    kind: 'drag-x',
    aspectHeight: 240,
    create: createBreakout,
  },
  {
    id: '2048',
    label: '2048',
    blurb: '滑动合并，凑到 2048。',
    hint: '2048。方向键或滑动移动，空格开始或暂停。',
    kind: 'swipe',
    aspectHeight: 240,
    create: createGame2048,
  },
];

const STORAGE_PREFIX = 'yl_game_best_';

function loadBestScore(id: string): number {
  try {
    const saved = typeof window !== 'undefined' ? window.localStorage?.getItem(`${STORAGE_PREFIX}${id}`) : null;
    return saved ? parseInt(saved, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(id: string, score: number) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(`${STORAGE_PREFIX}${id}`, String(score));
    }
  } catch {}
}

const bestScores: Record<string, number> = {
  rain: loadBestScore('rain'),
  snake: loadBestScore('snake'),
  breakout: loadBestScore('breakout'),
  '2048': loadBestScore('2048'),
};

const mounts = new WeakMap<HTMLElement, () => void>();

export function initGame(frame: HTMLElement, id: string): () => void {
  const entry = GAME_LIST.find((item) => item.id === id);
  if (!entry) return () => {};

  const previous = mounts.get(frame);
  if (previous) previous();

  const doc = frame.ownerDocument;
  const view = doc.defaultView;
  const canvas = frame.querySelector<HTMLCanvasElement>('[data-game-canvas]');
  const stage = frame.querySelector<HTMLElement>('[data-game-stage]');
  const scoreEl = frame.querySelector<HTMLElement>('[data-game-score]');
  const bestEl = frame.querySelector<HTMLElement>('[data-game-best]');
  const toggle = frame.querySelector<HTMLButtonElement>('[data-game-action="toggle"]');
  const soundBtn = frame.querySelector<HTMLButtonElement>('[data-game-action="sound"]');
  const fullButton = frame.querySelector<HTMLButtonElement>('[data-game-action="fullscreen"]');
  const fullLabel = frame.querySelector<HTMLElement>('[data-game-fullscreen-label]');
  const closeBtn = frame.querySelector<HTMLButtonElement>('[data-game-modal-close]');
  const touchWrap = frame.querySelector<HTMLElement>('[data-game-touch-controls]');
  const domOverlay = frame.querySelector<HTMLElement>('[data-game-dom-overlay]');
  const domHint = frame.querySelector<HTMLElement>('[data-game-dom-hint]');
  const deck = frame.closest('[data-game-deck]') || frame;
  const backdrop = deck.querySelector<HTMLElement>('[data-game-modal-backdrop]');

  if (!view || !canvas || !toggle || !fullButton || !fullLabel || !scoreEl || !bestEl) {
    return () => {};
  }

  let active: Game | null = null;
  let current = entry;
  let phase: Phase = 'idle';

  const updateSoundUI = () => {
    if (!soundBtn) return;
    const muted = isSoundMuted();
    soundBtn.textContent = muted ? '🔇 静音' : '🔊 声音';
    soundBtn.classList.toggle('is-muted', muted);
    soundBtn.setAttribute('aria-label', muted ? '声音已静音，点击开启' : '声音已开启，点击静音');
  };

  const onSoundToggle = () => {
    toggleSound();
    updateSoundUI();
  };

  soundBtn?.addEventListener('click', onSoundToggle);
  updateSoundUI();

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

  const updateOverlay = () => {
    if (!domOverlay || !domHint) return;
    if (phase === 'playing') {
      domOverlay.classList.add('is-hidden');
    } else {
      domOverlay.classList.remove('is-hidden');
      if (phase === 'paused') {
        domHint.textContent = '游戏已暂停 · 点击继续或按空格';
      } else if (phase === 'over') {
        domHint.textContent = '游戏结束 · 点击重来或按空格';
      } else if (phase === 'won') {
        domHint.textContent = '全清过关！· 点击再来一局';
      } else {
        domHint.textContent = current.hint;
      }
    }
  };

  const paintButtons = () => {
    canvas.setAttribute('aria-label', current.hint);

    if (phase === 'playing') toggle.textContent = '暂停';
    else if (phase === 'paused') toggle.textContent = '继续';
    else if (phase === 'over') toggle.textContent = '再来一局';
    else if (phase === 'won') toggle.textContent = '过关！';
    else toggle.textContent = '开始';

    updateOverlay();
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
      playSound,
      onState: (state) => {
        phase = state.phase;
        const currentScore = Math.floor(state.score);
        scoreEl.textContent = `得分 ${String(currentScore).padStart(3, '0')}`;
        if (currentScore > (bestScores[current.id] || 0)) {
          bestScores[current.id] = currentScore;
          saveBestScore(current.id, currentScore);
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
    closeBtn,
    backdrop,
    label: fullLabel,
    onChange: (_mode: ScreenMode) => active?.resize(),
  });

  domOverlay?.addEventListener('click', onToggle);
  toggle.addEventListener('click', onToggle);

  /* CSS user-select keeps iOS text selection off the controls, but some
     Safari versions still offer the copy / callout sheet on a long press.
     Swallow the context menu over the controls only; taps still work. */
  const isControlTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest('button, canvas, .game-topbar, .game-touch-controls, .game-dom-overlay');
  const onContextMenu = (event: Event) => {
    if (isControlTarget(event.target)) event.preventDefault();
  };
  deck.addEventListener('contextmenu', onContextMenu);

  doc.addEventListener('yl-theme-change', onTheme);
  view.addEventListener('resize', onResize);

  const onVisibility = () => {
    if (doc.hidden && phase === 'playing') {
      active?.pause();
    }
  };
  doc.addEventListener('visibilitychange', onVisibility);

  let observer: IntersectionObserver | null = null;
  if ('IntersectionObserver' in view) {
    observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && phase === 'playing') {
            active?.pause();
          }
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(frame);
  }

  mount(current);

  const cleanup = () => {
    active?.destroy();
    active = null;
    stopTouch();
    stopInput();
    stopFull();
    soundBtn?.removeEventListener('click', onSoundToggle);
    toggle.removeEventListener('click', onToggle);
    deck.removeEventListener('contextmenu', onContextMenu);
    doc.removeEventListener('yl-theme-change', onTheme);
    view.removeEventListener('resize', onResize);
    doc.removeEventListener('visibilitychange', onVisibility);
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (mounts.get(frame) === cleanup) mounts.delete(frame);
  };

  mounts.set(frame, cleanup);
  return cleanup;
}
