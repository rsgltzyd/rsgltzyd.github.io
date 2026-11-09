/** Local-clock helpers for auto shade and sun/moon rest pose. */

export type ClockShade = 'light' | 'dark';

export function localMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function shadeFromTime(mins: number = localMinutes()): ClockShade {
  return mins >= 6 * 60 && mins < 18 * 60 ? 'light' : 'dark';
}

export function clockPrefersDark(date: Date = new Date()): boolean {
  return shadeFromTime(localMinutes(date)) === 'dark';
}

export function arcProgress(mins: number, body: ClockShade): number {
  if (body === 'light') {
    return Math.max(0, Math.min(1, (mins - 6 * 60) / (12 * 60)));
  }
  let t = mins - 18 * 60;
  if (t < 0) t += 24 * 60;
  return Math.max(0, Math.min(1, t / (12 * 60)));
}

export function restOffset(progress: number): { x: number; y: number; s: number } {
  const pts = [
    { t: 0, x: -3, y: 2, s: 0.94 },
    { t: 0.5, x: 0, y: 0, s: 1 },
    { t: 1, x: 2, y: 2, s: 0.94 },
  ];
  const p = Math.max(0, Math.min(1, progress));
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].t < p) i += 1;
  const a = pts[i];
  const b = pts[i + 1];
  const u = (p - a.t) / Math.max(1e-6, b.t - a.t);
  const ease = u * u * (3 - 2 * u);
  return {
    x: a.x + (b.x - a.x) * ease,
    y: a.y + (b.y - a.y) * ease,
    s: a.s + (b.s - a.s) * ease,
  };
}

export function msUntilNextMinute(date: Date = new Date()): number {
  return Math.max(200, (60 - date.getSeconds()) * 1000 - date.getMilliseconds());
}
