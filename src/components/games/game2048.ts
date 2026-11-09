import { clear, fitCanvas } from './canvas';
import type { Direction, Game, GameContext, Input, Palette, Phase } from './types';

type Board = number[];

function slide(line: number[]): { line: number[]; score: number; moved: boolean } {
  const compact = line.filter((value) => value !== 0);
  const next: number[] = [];
  let score = 0;
  for (let i = 0; i < compact.length; i += 1) {
    if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
      const merged = compact[i] * 2;
      next.push(merged);
      score += merged;
      i += 1;
    } else {
      next.push(compact[i]);
    }
  }
  while (next.length < 4) next.push(0);
  return { line: next, score, moved: next.some((value, index) => value !== line[index]) };
}

function readLine(board: Board, direction: Direction, index: number): number[] {
  const line: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    if (direction === 'left') line.push(board[index * 4 + i]);
    if (direction === 'right') line.push(board[index * 4 + (3 - i)]);
    if (direction === 'up') line.push(board[i * 4 + index]);
    if (direction === 'down') line.push(board[(3 - i) * 4 + index]);
  }
  return line;
}

function writeLine(board: Board, direction: Direction, index: number, line: number[]) {
  for (let i = 0; i < 4; i += 1) {
    if (direction === 'left') board[index * 4 + i] = line[i];
    if (direction === 'right') board[index * 4 + (3 - i)] = line[i];
    if (direction === 'up') board[i * 4 + index] = line[i];
    if (direction === 'down') board[(3 - i) * 4 + index] = line[i];
  }
}

function canMove(board: Board): boolean {
  if (board.some((value) => value === 0)) return true;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const value = board[row * 4 + col];
      if (col < 3 && value === board[row * 4 + col + 1]) return true;
      if (row < 3 && value === board[(row + 1) * 4 + col]) return true;
    }
  }
  return false;
}

export function createGame2048(): Game {
  let context: GameContext | null = null;
  let palette: Palette | null = null;
  let phase: Phase = 'idle';
  let score = 0;
  let board: Board = Array(16).fill(0);
  let dead = false;

  const report = () => context?.onState({ phase, score, lives: null });

  const spawn = () => {
    if (!context) return false;
    const open = board.map((value, index) => (value === 0 ? index : -1)).filter((index) => index >= 0);
    if (open.length === 0) return false;
    const index = open[Math.floor(context.random() * open.length)];
    board[index] = context.random() < 0.9 ? 2 : 4;
    return true;
  };

  const boot = () => {
    board = Array(16).fill(0);
    score = 0;
    spawn();
    spawn();
  };

  const draw = () => {
    if (!context || !palette) return;
    const view = fitCanvas(context.canvas);
    if (!view) return;
    clear(view, palette.surface);
    const size = Math.min(view.width, view.height) - 24;
    const ox = (view.width - size) / 2;
    const oy = (view.height - size) / 2;
    const gap = 8;
    const cell = (size - gap * 5) / 4;
    const { ctx } = view;
    ctx.fillStyle = palette.paper;
    ctx.fillRect(ox, oy, size, size);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const value = board[row * 4 + col];
        const x = ox + gap + col * (cell + gap);
        const y = oy + gap + row * (cell + gap);
        ctx.fillStyle = value ? palette.tile : palette.surface;
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = palette.line;
        ctx.strokeRect(x, y, cell, cell);
        if (!value) continue;
        ctx.fillStyle = palette.tileInk;
        ctx.font = `${Math.max(16, cell * 0.38)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(value), x + cell / 2, y + cell / 2);
      }
    }
    if (phase === 'won' || phase === 'over') {
      ctx.fillStyle = palette.win;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(ox, oy, size, size);
      ctx.globalAlpha = 1;
    }
  };

  const move = (direction: Direction) => {
    if (phase !== 'playing') return;
    const next = board.slice();
    let gained = 0;
    let moved = false;
    for (let index = 0; index < 4; index += 1) {
      const line = readLine(next, direction, index);
      const result = slide(line);
      writeLine(next, direction, index, result.line);
      gained += result.score;
      moved = moved || result.moved;
    }
    if (!moved) return;
    board = next;
    score += gained;
    if (gained > 0) {
      context?.playSound?.('score');
    } else {
      context?.playSound?.('hit');
    }
    if (board.some((value) => value >= 2048)) {
      phase = 'won';
      context?.playSound?.('win');
      draw();
      report();
      return;
    }
    spawn();
    if (!canMove(board)) {
      phase = 'over';
      context?.playSound?.('over');
    }
    draw();
    report();
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
      if (dead || phase !== 'idle') return;
      phase = 'playing';
      context?.playSound?.('start');
      draw();
      report();
    },
    pause() {
      if (phase !== 'playing') return;
      phase = 'paused';
      draw();
      report();
    },
    resume() {
      if (phase !== 'paused') return;
      phase = 'playing';
      draw();
      report();
    },
    reset() {
      phase = 'idle';
      boot();
      draw();
      report();
    },
    destroy() {
      dead = true;
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
      if (input.kind === 'direction' && !input.held) move(input.direction);
      if (input.kind === 'direction' && input.held) move(input.direction);
    },
    resize() {
      draw();
    },
  };
}
