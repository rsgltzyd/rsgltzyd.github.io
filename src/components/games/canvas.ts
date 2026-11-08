import type { Palette } from './types';

export interface View {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export function readPalette(root: Element): Palette {
  const style = getComputedStyle(root);
  const value = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    paper: value('--paper', '#202120'),
    surface: value('--game-surface', value('--surface', '#292a28')),
    ink: value('--game-ink', value('--ink', '#eeece5')),
    muted: value('--muted', '#a4a296'),
    line: value('--game-line', value('--line', '#85867f')),
    tile: value('--tile', '#333430'),
    tileInk: value('--tile-ink', '#eeece5'),
    win: value('--win', '#d5e4c4'),
    winInk: value('--win-ink', '#1a2414'),
  };
}

export function fitCanvas(canvas: HTMLCanvasElement): View | null {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (width < 2 || height < 2) return null;
  const dpr = Math.min(canvas.ownerDocument.defaultView?.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

export function clear(view: View, color: string) {
  view.ctx.clearRect(0, 0, view.width, view.height);
  view.ctx.fillStyle = color;
  view.ctx.fillRect(0, 0, view.width, view.height);
}

export function canvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return { x: clientX - rect.left, y: clientY - rect.top };
}
