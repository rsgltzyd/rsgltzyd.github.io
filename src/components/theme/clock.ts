/** Local-clock helpers for newspaper editions, shade, and sun/moon pose. */

export type ClockShade = 'light' | 'dark';

export type EditionId = 'morning' | 'day' | 'evening' | 'night';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow';

const MORNING_START = 5 * 60 + 30;
const DAY_START = 8 * 60 + 30;
const EVENING_START = 16 * 60 + 30;
const NIGHT_START = 19 * 60;

export function localMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function editionFromTime(mins: number = localMinutes()): EditionId {
  if (mins >= MORNING_START && mins < DAY_START) return 'morning';
  if (mins >= DAY_START && mins < EVENING_START) return 'day';
  if (mins >= EVENING_START && mins < NIGHT_START) return 'evening';
  return 'night';
}

export function shadeFromEdition(edition: EditionId): ClockShade {
  return edition === 'night' ? 'dark' : 'light';
}

export function editionLabel(edition: EditionId): string {
  if (edition === 'morning') return '晨报';
  if (edition === 'day') return '日刊';
  if (edition === 'evening') return '晚报';
  return '夜刊';
}

export function weatherLabel(weather: WeatherKind): string {
  if (weather === 'cloudy') return '阴';
  if (weather === 'rain') return '微雨';
  if (weather === 'snow') return '微雪';
  return '晴';
}

export function shadeFromTime(mins: number = localMinutes()): ClockShade {
  return shadeFromEdition(editionFromTime(mins));
}

export function clockPrefersDark(date: Date = new Date()): boolean {
  return shadeFromTime(localMinutes(date)) === 'dark';
}

export function arcProgress(mins: number, body: ClockShade): number {
  if (body === 'light') {
    const span = NIGHT_START - MORNING_START;
    return Math.max(0, Math.min(1, (mins - MORNING_START) / span));
  }
  const nightSpan = 24 * 60 - NIGHT_START + MORNING_START;
  let t = mins - NIGHT_START;
  if (t < 0) t += 24 * 60;
  return Math.max(0, Math.min(1, t / nightSpan));
}

export function arcPoint(progress: number): { x: number; y: number; s: number } {
  const p = Math.max(0, Math.min(1, progress));
  return {
    x: (p - 0.5) * 6,
    y: Math.pow((p - 0.5) * 2, 2) * 2.5,
    s: 0.96 + 0.04 * Math.sin(Math.PI * p),
  };
}

export function msUntilNextMinute(date: Date = new Date()): number {
  return Math.max(200, (60 - date.getSeconds()) * 1000 - date.getMilliseconds());
}
