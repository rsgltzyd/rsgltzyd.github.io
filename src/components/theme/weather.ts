/** Silent IP geolocation + Open-Meteo weather fetcher with 30-min cache. */

import type { WeatherKind } from './clock';

export const WEATHER_CACHE_KEY = 'yl-weather-cache-v1';

const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4500;

interface CachedWeather {
  weather: WeatherKind;
  ts: number;
}

export function isWeatherKind(value: unknown): value is WeatherKind {
  return value === 'clear' || value === 'cloudy' || value === 'rain' || value === 'snow';
}

export function readCachedWeather(storage: Storage | null, now = Date.now()): WeatherKind | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedWeather> | null;
    if (!parsed || !isWeatherKind(parsed.weather) || typeof parsed.ts !== 'number') {
      return null;
    }
    const age = now - parsed.ts;
    if (age < 0 || age >= CACHE_TTL_MS) return null;
    return parsed.weather;
  } catch {
    return null;
  }
}

export function writeCachedWeather(storage: Storage | null, weather: WeatherKind, now = Date.now()): void {
  if (!storage) return;
  try {
    const payload: CachedWeather = { weather, ts: now };
    storage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* Ignore storage quota or security restrictions. */
  }
}

export function mapWmoCode(code: number): WeatherKind {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy';
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) {
    return 'snow';
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) {
    return 'rain';
  }
  return 'clear';
}

async function fetchJson(url: string, timeoutMs: number, outerSignal?: AbortSignal): Promise<unknown> {
  if (outerSignal?.aborted) return null;
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await globalThis.fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
}

function extractCoords(data: unknown): { lat: number; lon: number } | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.success === false) return null;
  const lat = Number(record.latitude);
  const lon = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

async function fetchGeoCoords(signal?: AbortSignal): Promise<{ lat: number; lon: number } | null> {
  const primary = extractCoords(
    await fetchJson('https://get.geojs.io/v1/ip/geo.json', REQUEST_TIMEOUT_MS, signal),
  );
  if (primary) return primary;

  return extractCoords(
    await fetchJson('https://ipwho.is/', REQUEST_TIMEOUT_MS, signal),
  );
}

export async function fetchLiveWeather(signal?: AbortSignal): Promise<WeatherKind | null> {
  const coords = await fetchGeoCoords(signal);
  if (!coords || signal?.aborted) return null;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(String(coords.lat))}` +
    `&longitude=${encodeURIComponent(String(coords.lon))}` +
    `&current=weather_code&timezone=auto`;

  const data = await fetchJson(url, REQUEST_TIMEOUT_MS, signal);
  if (!data || typeof data !== 'object') return null;
  const current = (data as { current?: { weather_code?: unknown } }).current;
  const code = Number(current?.weather_code);
  if (!Number.isFinite(code)) return null;

  return mapWmoCode(code);
}
