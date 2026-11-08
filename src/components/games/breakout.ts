import { clear, fitCanvas } from './canvas';
import type { Game, GameContext, Input, Palette, Phase } from './types';

const COLS = 8;
const ROWS = 4;

export function createBreakout(): Game {
  let context: GameContext | null = null;
  let palette: Palette | null = null;
  let phase: Phase = 'idle';
  let score = 0;
  let lives = 3;
  let paddle = 160;
  let held = 0;
  let ball = { x: 160, y: 200, vx: 140, vy: -180 };
  let alive: boolean[] = [];
  let raf = 0;
  let last = 0;
  let dead = false;

  const report = () => context?.onState({ phase, score, lives });
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  const brickBox = (width: number, index: number) => {
    const gap = 6;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const w = (width - gap * (COLS + 1)) / COLS;
    const h = 16;
    return { x: gap + col * (w + gap), y: 28 + row * (h + gap), w, h };
  };

  const layout = (width: number, height: number) => {
    alive = Array(COLS * ROWS).fill(true);
    paddle = width / 2;
    ball = { x: width / 2, y: height - 78, vx: 150, vy: -190 };
  };

  const draw = () => {
    if (!context || !palette) return;
    const view = fitCanvas(context.canvas);
    if (!view) return;
    clear(view, palette.surface);
    const { ctx } = view;
    ctx.fillStyle = palette.tile;
    ctx.strokeStyle = palette.line;
    alive.forEach((isAlive, index) => {
      if (!isAlive) return;
      const brick = brickBox(view.width, index);
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);
    });
    ctx.fillStyle = palette.ink;
    ctx.fillRect(paddle - 36, view.height - 36, 72, 10);
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
    ctx.fill();
  };

  const serve = (width: number, height: number) => {
    ball = { x: paddle, y: height - 78, vx: 150, vy: -190 };
  };

  const tick = (dt: number, width: number, height: number) => {
    const steps = 4;
    const step = dt / steps;
    for (let n = 0; n < steps; n += 1) {
      paddle += held * 260 * step;
      paddle = Math.max(36, Math.min(width - 36, paddle));
      ball.x += ball.vx * step;
      ball.y += ball.vy * step;
      if (ball.x < 6) {
        ball.x = 6;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x > width - 6) {
        ball.x = width - 6;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y < 6) {
        ball.y = 6;
        ball.vy = Math.abs(ball.vy);
      }
      if (ball.y > height - 42 && ball.y < height - 20 && ball.x > paddle - 40 && ball.x < paddle + 40 && ball.vy > 0) {
        ball.vy = -Math.abs(ball.vy);
        ball.vx += (ball.x - paddle) * 3;
        ball.y = height - 42;
      }
      alive.forEach((isAlive, index) => {
        if (!isAlive) return;
        const brick = brickBox(width, index);
        if (ball.x < brick.x - 6 || ball.x > brick.x + brick.w + 6 || ball.y < brick.y - 6 || ball.y > brick.y + brick.h + 6) return;
        alive[index] = false;
        score += 10;
        const fromLeft = Math.abs(ball.x - brick.x);
        const fromRight = Math.abs(ball.x - (brick.x + brick.w));
        const fromTop = Math.abs(ball.y - brick.y);
        const fromBottom = Math.abs(ball.y - (brick.y + brick.h));
        const horizontal = Math.min(fromLeft, fromRight) < Math.min(fromTop, fromBottom);
        if (horizontal) ball.vx *= -1;
        else ball.vy *= -1;
      });
    }
    if (ball.y > height + 8) {
      lives -= 1;
      if (lives <= 0) {
        phase = 'over';
        return;
      }
      serve(width, height);
    }
    if (alive.every((isAlive) => !isAlive)) phase = 'won';
  };

  const loop = (time: number) => {
    if (dead || phase !== 'playing' || !context) return;
    const view = fitCanvas(context.canvas);
    if (!view) {
      raf = requestAnimationFrame(loop);
      return;
    }
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    if (dt) tick(dt, view.width, view.height);
    draw();
    report();
    if (phase !== 'playing') {
      stop();
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  return {
    init(next) {
      context = next;
      palette = next.palette;
      dead = false;
      phase = 'idle';
      score = 0;
      lives = 3;
      held = 0;
      const view = fitCanvas(next.canvas);
      layout(view?.width ?? 320, view?.height ?? 360);
      draw();
      report();
    },
    start() {
      if (phase !== 'idle') return;
      phase = 'playing';
      last = 0;
      report();
      raf = requestAnimationFrame(loop);
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
      raf = requestAnimationFrame(loop);
    },
    reset() {
      stop();
      phase = 'idle';
      score = 0;
      lives = 3;
      held = 0;
      const view = context ? fitCanvas(context.canvas) : null;
      layout(view?.width ?? 320, view?.height ?? 360);
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
      if (input.kind === 'point') {
        paddle = input.x;
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
