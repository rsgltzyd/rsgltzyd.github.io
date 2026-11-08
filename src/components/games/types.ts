export type Phase = 'idle' | 'playing' | 'paused' | 'over' | 'won';

export type Direction = 'left' | 'right' | 'up' | 'down';

export type Input =
  | { kind: 'direction'; direction: Direction; held?: boolean }
  | { kind: 'point'; x: number; y: number }
  | { kind: 'hold-x'; dir: 'left' | 'right'; active: boolean }
  | { kind: 'dir'; dir: Direction }
  | { kind: 'release' };

export interface Palette {
  paper: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  tile: string;
  tileInk: string;
  win: string;
  winInk: string;
}

export interface GameState {
  phase: Phase;
  score: number;
  lives: number | null;
}

export interface GameContext {
  canvas: HTMLCanvasElement;
  palette: Palette;
  random: () => number;
  onState: (state: GameState) => void;
  playSound?: (effect: 'start' | 'score' | 'hit' | 'break' | 'over' | 'win') => void;
}

export interface Game {
  init(context: GameContext): void;
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  destroy(): void;
  render(): void;
  setTheme(palette: Palette): void;
  input(input: Input): void;
  resize(): void;
}

export type ControlKind = 'drag-x' | 'swipe';
