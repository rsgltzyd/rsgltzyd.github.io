import { clear, fitCanvas } from './canvas';
import type { Direction, Game, GameContext, Input, Palette, Phase } from './types';

const COLS = 12;
const ROWS = 12;

interface Cell {
  x: number;
  y: number;
}

const VECTOR: Record<Direction, Cell> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

export function createSnake(): Game {
  let context: GameContext | null = null;
  let palette: Palette | null = null;
  let phase: Phase = 'idle';
  let score = 0;
  let snake: Cell[] = [];
  let dir: Cell = { x: 1, y: 0 };
  let pending: Cell = { x: 1, y: 0 };
  let food: Cell = { x: 8, y: 6 };
  let raf = 0;
  let last = 0;
  let acc = 0;
  let dead = false;

  const report = () => context?.onState({ phase, score, lives: null });
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    acc = 0;
  };

  const placeFood = () => {
    if (!context) return;
    const open: Cell[] = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!snake.some((cell) => cell.x === x && cell.y === y)) open.push({ x, y });
      }
    }
    if (open.length === 0) return;
    food = open[Math.floor(context.random() * open.length)];
  };

  const boot = () => {
    snake = [{ x: 3, y: 6 }, { x: 2, y: 6 }, { x: 1, y: 6 }];
    dir = { x: 1, y: 0 };
    pending = { x: 1, y: 0 };
    score = 0;
    placeFood();
  };

  const opposite = (a: Cell, b: Cell) => a.x === -b.x && a.y === -b.y;

  const draw = () => {
    if (!context || !palette) return;
    const view = fitCanvas(context.canvas);
    if (!view) return;
    clear(view, palette.surface);
    const size = Math.min(view.width / COLS, view.height / ROWS);
    const ox = (view.width - size * COLS) / 2;
    const oy = (view.height - size * ROWS) / 2;
    const { ctx } = view;
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        ctx.strokeRect(ox + x * size, oy + y * size, size, size);
      }
    }
    ctx.fillStyle = palette.ink;
    snake.forEach((cell) => {
      ctx.fillRect(ox + cell.x * size + 2, oy + cell.y * size + 2, size - 4, size - 4);
    });
    ctx.fillStyle = palette.win;
    ctx.fillRect(ox + food.x * size + 3, oy + food.y * size + 3, size - 6, size - 6);
  };

  const step = () => {
    if (!opposite(pending, dir)) dir = pending;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
      phase = 'over';
      return;
    }
    const grow = head.x === food.x && head.y === food.y;
    const body = grow ? snake : snake.slice(0, -1);
    if (body.some((cell) => cell.x === head.x && cell.y === head.y)) {
      phase = 'over';
      return;
    }
    snake = [head, ...snake];
    if (!grow) snake.pop();
    else {
      score += 1;
      if (snake.length >= COLS * ROWS) {
        phase = 'won';
        return;
      }
      placeFood();
    }
  };

  const loop = (time: number) => {
    if (dead || phase !== 'playing') return;
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    acc += dt;
    while (acc >= 0.16 && phase === 'playing') {
      acc -= 0.16;
      step();
    }
    draw();
    report();
    if (phase !== 'playing') {
      stop();
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  const queue = (direction: Direction) => {
    if (phase !== 'playing') return;
    pending = VECTOR[direction];
  };

  return {
    init(next) {
      context = next;
      palette = next.palette;
      dead = false;
      phase = 'idle';
      boot();
      draw();
      report();
    },
    start() {
      if (phase !== 'idle') return;
      phase = 'playing';
      last = 0;
      acc = 0;
      report();
      raf = requestAnimationFrame(loop);
    },
    pause() {
      if (phase !== 'playing') return;
      phase = 'paused';
      stop();
      draw();
      report();
    },
    resume() {
      if (phase !== 'paused') return;
      phase = 'playing';
      last = 0;
      acc = 0;
      report();
      raf = requestAnimationFrame(loop);
    },
    reset() {
      stop();
      phase = 'idle';
      boot();
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
      if (input.kind === 'direction') queue(input.direction);
    },
    resize() {
      draw();
    },
  };
}
