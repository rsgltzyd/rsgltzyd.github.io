/**
 * Time-and-weather newspaper theme controller.
 * The head anti-flash script in BlogLayout.astro mirrors the 4 editions and
 * weather cache key so the first paint matches without flash.
 */

import {
  editionFromTime,
  editionLabel,
  localMinutes,
  msUntilNextMinute,
  shadeFromEdition,
  weatherLabel,
  type EditionId,
  type WeatherKind,
} from './clock';
import { fetchLiveWeather, readCachedWeather, writeCachedWeather } from './weather';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeChangeDetail {
  mode: 'auto';
  resolved: ResolvedTheme;
  edition: EditionId;
  weather: WeatherKind;
  minutes: number;
  previewing: boolean;
}

export interface YlStatus {
  edition: EditionId;
  editionLabel: string;
  weather: WeatherKind;
  weatherLabel: string;
  resolved: ResolvedTheme;
  minutes: number;
  previewing: boolean;
}

export interface YlConsoleApi {
  edition: (value?: EditionId | 'auto' | '晨报' | '日刊' | '晚报' | '夜刊' | '自动' | null) => YlStatus;
  time: (hourOrText?: number | string | null, minute?: number) => YlStatus;
  weather: (
    value?: WeatherKind | 'auto' | '晴' | '阴' | '多云' | '雨' | '微雨' | '雪' | '微雪' | '自动' | null,
  ) => YlStatus;
  reset: () => YlStatus;
  status: () => YlStatus;
  help: () => string;
}

declare global {
  interface Window {
    yl?: YlConsoleApi;
  }
}

const EDITION_PAPER: Record<EditionId, string> = {
  morning: '#f7f0e4',
  day: '#f6f2e9',
  evening: '#efe4d2',
  night: '#d3dce6',
};

const EDITION_SAMPLE_MINUTES: Record<EditionId, number> = {
  morning: 7 * 60,
  day: 12 * 60 + 30,
  evening: 17 * 60 + 45,
  night: 23 * 60,
};

const WEATHER_CYCLE: readonly WeatherKind[] = ['clear', 'cloudy', 'rain', 'snow'];

const EDITION_ALIASES: Record<string, EditionId | 'auto'> = {
  morning: 'morning',
  晨报: 'morning',
  day: 'day',
  日刊: 'day',
  evening: 'evening',
  晚报: 'evening',
  night: 'night',
  夜刊: 'night',
  auto: 'auto',
  自动: 'auto',
};

const WEATHER_ALIASES: Record<string, WeatherKind | 'auto'> = {
  clear: 'clear',
  晴: 'clear',
  cloudy: 'cloudy',
  阴: 'cloudy',
  多云: 'cloudy',
  rain: 'rain',
  雨: 'rain',
  微雨: 'rain',
  snow: 'snow',
  雪: 'snow',
  微雪: 'snow',
  auto: 'auto',
  自动: 'auto',
};

const HELP_TEXT = [
  '雨霖铃控制台命令 (window.yl):',
  "  yl.edition('morning' | 'day' | 'evening' | 'night' | 'auto')  // 支持中文: '晨报' '日刊' '晚报' '夜刊' '自动'",
  "  yl.time('07:30') | yl.time(17, 45) | yl.time('auto')          // 按指定时刻切换刊期与日月位置",
  "  yl.weather('clear' | 'cloudy' | 'rain' | 'snow' | 'auto')     // 支持中文: '晴' '阴' '微雨' '微雪' '自动'",
  '  yl.status()                                                   // 查看当前刊期与天气状态',
  '  yl.reset()                                                    // 恢复实时时钟与天气',
].join('\n');

const controllers = new WeakMap<Document, () => void>();

function openStorage(view: Window): Storage | null {
  try {
    return view.localStorage;
  } catch {
    return null;
  }
}

function parseTimeInput(hourOrText: number | string, minute = 0): number | 'auto' | null {
  if (typeof hourOrText === 'string') {
    const trimmed = hourOrText.trim().toLowerCase();
    if (trimmed === 'auto' || trimmed === '自动') return 'auto';
    const match = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }
  if (typeof hourOrText === 'number' && Number.isFinite(hourOrText) && Number.isFinite(minute)) {
    const h = Math.floor(hourOrText);
    const m = Math.floor(minute);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }
  return null;
}

export function initThemeController(
  doc: Document = document,
  viewOverride?: Window,
): () => void {
  const win = viewOverride ?? doc.defaultView;
  if (!win) return () => {};
  const view = win;

  const existing = controllers.get(doc);
  if (existing) {
    existing();
    controllers.delete(doc);
  }

  const storage = openStorage(view);
  const root = doc.documentElement;
  const weatherAbort = new AbortController();

  let previewEdition: EditionId | null = null;
  let previewMinutes: number | null = null;
  let resolved: ResolvedTheme = shadeFromEdition(editionFromTime(localMinutes()));
  const cachedWeather = readCachedWeather(storage);
  let liveWeather: WeatherKind = cachedWeather ?? 'clear';
  let previewWeather: WeatherKind | null = null;
  let minuteTimer: number | null = null;
  let minuteTimeout: number | null = null;
  let switchingTimer: number | null = null;
  let disposed = false;

  function activeMinutes(): number {
    if (previewMinutes !== null) return previewMinutes;
    if (previewEdition !== null) return EDITION_SAMPLE_MINUTES[previewEdition];
    return localMinutes();
  }

  function activeEdition(): EditionId {
    return previewEdition ?? editionFromTime(activeMinutes());
  }

  function activeWeather(): WeatherKind {
    return previewWeather ?? liveWeather;
  }

  function isPreviewing(): boolean {
    return previewWeather !== null || previewEdition !== null || previewMinutes !== null;
  }

  function snapshot(): YlStatus {
    const edition = activeEdition();
    const weather = activeWeather();
    return {
      edition,
      editionLabel: editionLabel(edition),
      weather,
      weatherLabel: weatherLabel(weather),
      resolved: shadeFromEdition(edition),
      minutes: activeMinutes(),
      previewing: isPreviewing(),
    };
  }

  function apply() {
    const edition = activeEdition();
    const nextResolved = shadeFromEdition(edition);
    const shadeChanged = nextResolved !== resolved;
    if (shadeChanged) {
      // Lock color/fill/stroke interpolation before tokens swap.
      root.setAttribute('data-theme-switching', '');
      void root.offsetWidth;
      if (switchingTimer !== null) view.clearTimeout(switchingTimer);
      switchingTimer = view.setTimeout(() => {
        root.removeAttribute('data-theme-switching');
        switchingTimer = null;
      }, 400);
    }

    resolved = nextResolved;
    const weather = activeWeather();
    const minutes = activeMinutes();

    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-edition', edition);
    root.setAttribute('data-weather', weather);
    root.style.colorScheme = 'light';

    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', EDITION_PAPER[edition]);

    doc.dispatchEvent(
      new CustomEvent<ThemeChangeDetail>('yl-theme-change', {
        detail: {
          mode: 'auto',
          resolved,
          edition,
          weather,
          minutes,
          previewing: isPreviewing(),
        },
      }),
    );
  }

  function cycleWeatherPreview() {
    if (previewWeather === null) {
      const idx = WEATHER_CYCLE.indexOf(liveWeather);
      previewWeather = WEATHER_CYCLE[(idx + 1) % WEATHER_CYCLE.length];
    } else {
      const idx = WEATHER_CYCLE.indexOf(previewWeather);
      const next = WEATHER_CYCLE[(idx + 1) % WEATHER_CYCLE.length];
      previewWeather = next === liveWeather ? null : next;
    }
    apply();
  }

  const api: YlConsoleApi = {
    edition(value) {
      if (value === undefined) return snapshot();
      if (value === null) {
        previewEdition = null;
        previewMinutes = null;
        apply();
        return snapshot();
      }
      const mapped = EDITION_ALIASES[String(value).trim().toLowerCase()] ?? EDITION_ALIASES[String(value).trim()];
      if (!mapped) return snapshot();
      if (mapped === 'auto') {
        previewEdition = null;
        previewMinutes = null;
      } else {
        previewEdition = mapped;
        previewMinutes = null;
      }
      apply();
      return snapshot();
    },
    time(hourOrText, minute = 0) {
      if (hourOrText === undefined) return snapshot();
      if (hourOrText === null) {
        previewEdition = null;
        previewMinutes = null;
        apply();
        return snapshot();
      }
      const parsed = parseTimeInput(hourOrText, minute);
      if (parsed === null) return snapshot();
      if (parsed === 'auto') {
        previewEdition = null;
        previewMinutes = null;
      } else {
        previewEdition = null;
        previewMinutes = parsed;
      }
      apply();
      return snapshot();
    },
    weather(value) {
      if (value === undefined) return snapshot();
      if (value === null) {
        previewWeather = null;
        apply();
        return snapshot();
      }
      const mapped = WEATHER_ALIASES[String(value).trim().toLowerCase()] ?? WEATHER_ALIASES[String(value).trim()];
      if (!mapped) return snapshot();
      previewWeather = mapped === 'auto' ? null : mapped;
      apply();
      return snapshot();
    },
    reset() {
      previewEdition = null;
      previewMinutes = null;
      previewWeather = null;
      apply();
      return snapshot();
    },
    status() {
      return snapshot();
    },
    help() {
      return HELP_TEXT;
    },
  };

  view.yl = api;

  function onClick(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-weather-cycle]')) {
      cycleWeatherPreview();
    }
  }

  function onClockTick() {
    if (previewEdition === null && previewMinutes === null) {
      apply();
    }
  }

  function armClock() {
    if (minuteTimeout !== null) view.clearTimeout(minuteTimeout);
    if (minuteTimer !== null) view.clearInterval(minuteTimer);
    minuteTimeout = view.setTimeout(() => {
      onClockTick();
      minuteTimer = view.setInterval(onClockTick, 60_000);
    }, msUntilNextMinute());
  }

  doc.addEventListener('click', onClick);
  armClock();
  apply();

  if (cachedWeather === null) {
    void fetchLiveWeather(weatherAbort.signal).then((fetched) => {
      if (disposed || !fetched) return;
      liveWeather = fetched;
      writeCachedWeather(storage, fetched);
      if (previewWeather === null) {
        apply();
      }
    });
  }

  const cleanup = () => {
    disposed = true;
    weatherAbort.abort();
    doc.removeEventListener('click', onClick);
    if (minuteTimeout !== null) view.clearTimeout(minuteTimeout);
    if (minuteTimer !== null) view.clearInterval(minuteTimer);
    if (switchingTimer !== null) view.clearTimeout(switchingTimer);
    root.removeAttribute('data-theme-switching');
    if (view.yl === api) {
      delete view.yl;
    }
  };

  controllers.set(doc, cleanup);

  return cleanup;
}
