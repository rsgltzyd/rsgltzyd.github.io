/**
 * Season, day-night, and weather parameters ported directly from
 * `season_switcher_ui.py` inside `雪花玻璃球.blend`.
 *
 * All color triplets are linear-sRGB values matching Blender's shader inputs;
 * pass them to `THREE.Color.setRGB(r, g, b, THREE.LinearSRGBColorSpace)`.
 */

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherId = 'CLEAR' | 'CLOUDY' | 'PRECIP';
export type Rgb3 = readonly [number, number, number];

export interface SeasonMeta {
  id: SeasonId;
  shortLabel: string;
  label: string;
  subtitle: string;
  precipLabel: string;
}

export const SEASONS: readonly SeasonMeta[] = [
  { id: 'spring', shortLabel: '春', label: '春 · 樱花', subtitle: '樱花纷飞', precipLabel: '春雨' },
  { id: 'summer', shortLabel: '夏', label: '夏 · 萤夜', subtitle: '盛夏萤夜', precipLabel: '阵雨' },
  { id: 'autumn', shortLabel: '秋', label: '秋 · 红枫', subtitle: '金秋红枫', precipLabel: '秋雨' },
  { id: 'winter', shortLabel: '冬', label: '冬 · 飞雪', subtitle: '冬日飞雪', precipLabel: '大雪' },
] as const;

export const SEASON_MAP: Record<SeasonId, SeasonMeta> = {
  spring: SEASONS[0],
  summer: SEASONS[1],
  autumn: SEASONS[2],
  winter: SEASONS[3],
};

export const TIME_PRESETS = [
  { id: 'day', label: '白天', value: 0.0 },
  { id: 'dawn', label: '清晨', value: 0.22 },
  { id: 'dusk', label: '黄昏', value: 0.52 },
  { id: 'night', label: '黑夜', value: 1.0 },
] as const;

export const WEATHER_OPTIONS: readonly WeatherId[] = ['CLEAR', 'CLOUDY', 'PRECIP'];

export function weatherLabel(season: SeasonId, weather: WeatherId): string {
  if (weather === 'CLEAR') return '晴朗';
  if (weather === 'CLOUDY') return '多云';
  return SEASON_MAP[season].precipLabel;
}

export function timeLabel(t: number): string {
  if (t < 0.14) return '白天';
  if (t < 0.38) return '清晨 / 午后';
  if (t < 0.72) return '黄昏日落';
  return '夜晚';
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

export function lerpRgb(a: Rgb3, b: Rgb3, f: number): Rgb3 {
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * 2-segment smoothstep matching Blender's `_eval_3pt(v_day, v_dusk, v_night, t)`.
 */
export function eval3ptScalar(vDay: number, vDusk: number, vNight: number, t: number): number {
  const ct = clamp01(t);
  if (ct <= 0.5) {
    const f = ct / 0.5;
    const s = f * f * (3 - 2 * f);
    return lerp(vDay, vDusk, s);
  }
  const f = (ct - 0.5) / 0.5;
  const s = f * f * (3 - 2 * f);
  return lerp(vDusk, vNight, s);
}

export function eval3ptRgb(vDay: Rgb3, vDusk: Rgb3, vNight: Rgb3, t: number): Rgb3 {
  const ct = clamp01(t);
  if (ct <= 0.5) {
    const f = ct / 0.5;
    const s = f * f * (3 - 2 * f);
    return lerpRgb(vDay, vDusk, s);
  }
  const f = (ct - 0.5) / 0.5;
  const s = f * f * (3 - 2 * f);
  return lerpRgb(vDusk, vNight, s);
}

export interface SkyStop {
  low: Rgb3;
  high: Rgb3;
  strength: number;
}

export const WORLD_SKY: Record<SeasonId, { day: SkyStop; dusk: SkyStop; night: SkyStop }> = {
  spring: {
    day: { low: [0.22, 0.36, 0.58], high: [0.48, 0.66, 0.88], strength: 1.4 },
    dusk: { low: [0.22, 0.1, 0.14], high: [0.14, 0.15, 0.34], strength: 0.92 },
    night: { low: [0.035, 0.048, 0.115], high: [0.145, 0.125, 0.265], strength: 0.78 },
  },
  summer: {
    day: { low: [0.16, 0.38, 0.58], high: [0.36, 0.68, 0.9], strength: 1.45 },
    dusk: { low: [0.18, 0.11, 0.12], high: [0.08, 0.18, 0.32], strength: 0.88 },
    night: { low: [0.008, 0.032, 0.058], high: [0.032, 0.115, 0.175], strength: 0.62 },
  },
  autumn: {
    day: { low: [0.28, 0.34, 0.48], high: [0.54, 0.58, 0.72], strength: 1.38 },
    dusk: { low: [0.28, 0.1, 0.04], high: [0.22, 0.14, 0.24], strength: 0.95 },
    night: { low: [0.045, 0.016, 0.01], high: [0.165, 0.065, 0.028], strength: 0.68 },
  },
  winter: {
    day: { low: [0.24, 0.36, 0.54], high: [0.5, 0.64, 0.84], strength: 1.4 },
    dusk: { low: [0.16, 0.11, 0.2], high: [0.1, 0.16, 0.34], strength: 0.86 },
    night: { low: [0.012, 0.02, 0.048], high: [0.045, 0.095, 0.21], strength: 0.55 },
  },
};

export const BACKDROP_FLOOR: Record<SeasonId, { day: readonly [Rgb3, Rgb3]; dusk: readonly [Rgb3, Rgb3]; night: readonly [Rgb3, Rgb3] }> = {
  spring: {
    day: [[0.22, 0.28, 0.34], [0.42, 0.52, 0.64]],
    dusk: [[0.11, 0.08, 0.12], [0.24, 0.14, 0.19]],
    night: [[0.038, 0.048, 0.072], [0.024, 0.032, 0.055]],
  },
  summer: {
    day: [[0.18, 0.28, 0.33], [0.36, 0.56, 0.66]],
    dusk: [[0.08, 0.09, 0.13], [0.18, 0.14, 0.2]],
    night: [[0.028, 0.046, 0.068], [0.016, 0.03, 0.048]],
  },
  autumn: {
    day: [[0.28, 0.24, 0.2], [0.48, 0.44, 0.38]],
    dusk: [[0.14, 0.07, 0.05], [0.28, 0.13, 0.08]],
    night: [[0.048, 0.038, 0.034], [0.028, 0.02, 0.018]],
  },
  winter: {
    day: [[0.24, 0.29, 0.36], [0.44, 0.52, 0.64]],
    dusk: [[0.09, 0.09, 0.14], [0.2, 0.15, 0.24]],
    night: [[0.036, 0.046, 0.068], [0.02, 0.028, 0.048]],
  },
};

export interface NightLightPreset {
  keyColor: Rgb3;
  keyEnergy: number;
  rimColor: Rgb3;
  rimEnergy: number;
  frontColor: Rgb3;
  frontEnergy: number;
}

export const NIGHT_LIGHTS: Record<SeasonId, NightLightPreset> = {
  spring: {
    keyColor: [1.0, 0.9, 0.8],
    keyEnergy: 175,
    rimColor: [1.0, 0.78, 0.88],
    rimEnergy: 165,
    frontColor: [0.98, 0.92, 0.95],
    frontEnergy: 78,
  },
  summer: {
    keyColor: [1.0, 0.88, 0.66],
    keyEnergy: 170,
    rimColor: [0.5, 0.92, 0.98],
    rimEnergy: 175,
    frontColor: [0.85, 0.95, 0.9],
    frontEnergy: 68,
  },
  autumn: {
    keyColor: [1.0, 0.74, 0.42],
    keyEnergy: 185,
    rimColor: [1.0, 0.62, 0.34],
    rimEnergy: 175,
    frontColor: [0.98, 0.84, 0.68],
    frontEnergy: 72,
  },
  winter: {
    keyColor: [0.82, 0.91, 1.0],
    keyEnergy: 170,
    rimColor: [0.64, 0.84, 1.0],
    rimEnergy: 175,
    frontColor: [0.88, 0.93, 1.0],
    frontEnergy: 65,
  },
};

export const MOON_COLORS: Record<SeasonId, Rgb3> = {
  spring: [0.98, 0.96, 0.92],
  summer: [1.0, 0.94, 0.72],
  autumn: [1.0, 0.8, 0.38],
  winter: [0.86, 0.94, 1.0],
};

export const WEATHER_MUL: Record<
  WeatherId,
  {
    sky: number;
    key: number;
    sunScale: number;
    sunEm: number;
    moonScale: number;
    moonEm: number;
    starVis: number;
    cloudMainScale: number;
    cloudThickScale: number;
    cloudColorMul: number;
    cloudEmMul: number;
    cloudAlpha: number;
  }
> = {
  CLEAR: {
    sky: 1.0,
    key: 1.0,
    sunScale: 1.0,
    sunEm: 1.0,
    moonScale: 1.0,
    moonEm: 1.0,
    starVis: 1.0,
    cloudMainScale: 0.8,
    cloudThickScale: 0.0001,
    cloudColorMul: 1.0,
    cloudEmMul: 1.0,
    cloudAlpha: 0.88,
  },
  CLOUDY: {
    sky: 0.78,
    key: 0.72,
    sunScale: 0.85,
    sunEm: 0.55,
    moonScale: 0.88,
    moonEm: 0.55,
    starVis: 0.35,
    cloudMainScale: 1.05,
    cloudThickScale: 1.02,
    cloudColorMul: 0.72,
    cloudEmMul: 0.65,
    cloudAlpha: 0.94,
  },
  PRECIP: {
    sky: 0.56,
    key: 0.48,
    sunScale: 0.6,
    sunEm: 0.2,
    moonScale: 0.68,
    moonEm: 0.22,
    starVis: 0.0,
    cloudMainScale: 1.18,
    cloudThickScale: 1.2,
    cloudColorMul: 0.42,
    cloudEmMul: 0.3,
    cloudAlpha: 0.96,
  },
};

export const PARTICLE_GLOW: Record<SeasonId, { primary: readonly [number, number, number]; secondary: readonly [number, number, number] }> = {
  spring: { primary: [0.0, 0.16, 0.38], secondary: [0.0, 0.06, 0.14] },
  summer: { primary: [0.35, 6.5, 14.0], secondary: [0.15, 2.2, 4.5] },
  autumn: { primary: [0.0, 0.14, 0.28], secondary: [0.0, 0.14, 0.28] },
  winter: { primary: [0.0, 0.18, 0.35], secondary: [0.0, 0.24, 0.5] },
};
