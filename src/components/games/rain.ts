import { clear, fitCanvas } from './canvas';
import type { Game, GameContext, Input, Palette, Phase } from './types';

interface Drop {
  x: number;
  y: number;
  speed: number;
}

export function createRain(): Game {
  let context: GameContext | null = null;
  let palette: Palette | null = null;
  let phase: Phase = 'idle';
  let score = 0;
  let px = 160;
  let held = 0;
  let drops: Drop[] = [];
  let raf = 0;
  let last = 0;
  let dead = false;

  const report = () => context?.onState({ phase, score: Math.floor(score), lives: null });

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  const seed = () => {
    drops = [];
    const view = context ? fitCanvas(context.canvas) : null;
    const width = view?.width ?? 320;
    px = width / 2;
    for (let i = 0; i < 4; i += 1) {
      drops.push({
        x: 24 + (context?.random() ?? Math.random()) * (width - 48),
        y: 30 + i * 50,
        speed: 70,
      });
    }
  };

  const draw = () => {
    if (!context || !palette) return;
    const view = fitCanvas(context.canvas);
    if (!view) return;
    clear(view, palette.surface);
    const { ctx, width, height } = view;
    ctx.strokeStyle = palette.line;
    ctx.fillStyle = palette.ink;
    ctx.lineWidth = 1.6;
    drops.forEach((drop) => {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x, drop.y + 16);
      ctx.stroke();
    });
    const body = height - 58;
    ctx.strokeStyle = palette.ink;
    ctx.beginPath();
    ctx.arc(px, body - 28, 10, 0, Math.PI * 2);
    ctx.moveTo(px, body - 18);
    ctx.lineTo(px, body + 16);
    ctx.moveTo(px - 16, body);
    ctx.lineTo(px + 16, body);
    ctx.stroke();
    ctx.fillStyle = palette.muted;
    ctx.font = '14px sans-serif';
    ctx.fillText(phase === 'idle' ? '待机' : `${Math.floor(score)}`, 12, 22);
  };

  const hit = (width: number, height: number) => {
    const body = height - 58;
    return drops.some((drop) => Math.abs(drop.x - px) < 16 && drop.y + 16 > body - 36 && drop.y < body + 16);
  };

  const loop = (time: number) => {
    if (dead || phase !== 'playing' || !context || !palette) return;
    const view = fitCanvas(context.canvas);
    if (!view) {
      raf = requestAnimationFrame(loop);
      return;
    }
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    px += held * 200 * dt;
    px = Math.max(18, Math.min(view.width - 18, px));
    drops.forEach((drop) => {
      drop.y += drop.speed * dt;
    });
    drops = drops.filter((drop) => drop.y < view.height + 20);
    if (drops.length < 6 && context.random() < dt * 3) {
      drops.push({
        x: 16 + context.random() * (view.width - 32),
        y: -20,
        speed: 110 + context.random() * 90,
      });
    }
    score += dt * 10;
    if (hit(view.width, view.height)) {
      phase = 'over';
      stop();
      draw();
      report();
      return;
    }
    draw();
    report();
    raf = requestAnimationFrame(loop);
  };

  const play = () => {
    stop();
    raf = requestAnimationFrame(loop);
  };

  return {
    init(next) {
      context = next;
      palette = next.palette;
      dead = false;
      phase = 'idle';
      score = 0;
      held = 0;
      seed();
      draw();
      report();
    },
    start() {
      if (phase !== 'idle') return;
      phase = 'playing';
      last = 0;
      report();
      play();
    },
    pause() {
      if (phase !== 'playing') return;
      phase = 'paused';
      held = 0;
      stop();
      draw();
      report();
    },
    resume() {
      if (phase !== 'paused') return;
      phase = 'playing';
      last = 0;
      report();
      play();
    },
    reset() {
      stop();
      phase = 'idle';
      score = 0;
      held = 0;
      seed();
      draw();
      report();
    },
    destroy() {
      dead = true;
      stop();
      context = null;
    },
    render() {
      draw();
    },
    setTheme(next) {
      palette = next;
      draw();
    },
    input(input: Input) {
      if (input.kind === 'release') {
        held = 0;
        return;
      }
      if (input.kind === 'point' && context) {
        const rect = context.canvas.getBoundingClientRect();
        if (rect.width > 0) px = Math.max(18, Math.min(rect.width - 18, input.x));
        if (phase !== 'playing') draw();
        return;
      }
      if (input.kind === 'direction') {
        if (input.direction === 'left') held = -1;
        if (input.direction === 'right') held = 1;
      }
    },
    resize() {
      draw();
    },
  };
}
