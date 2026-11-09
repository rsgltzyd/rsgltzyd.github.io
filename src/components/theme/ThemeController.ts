/**
 * Theme state. The head anti-flash script in BlogLayout.astro duplicates the
 * key, the three exact mode strings, and the dark fallback. Keep them aligned.
 * theme-color hex values match --paper in global.css.
 *
 * auto follows the local clock: light from 06:00 to 18:00, dark otherwise.
 */

import { clockPrefersDark, msUntilNextMinute } from './clock';

export const THEME_STORAGE_KEY = 'yl-theme-mode-v1';

export const THEME_MODES = ['light', 'dark', 'auto'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeChangeDetail {
  mode: ThemeMode;
  resolved: ResolvedTheme;
}

const DEFAULT_MODE: ThemeMode = 'dark';

const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: '#202120',
  light: '#ffffff',
};

const controllers = new WeakMap<Document, () => void>();

let lifecycleBound = false;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function openStorage(view: Window): Storage | null {
  try {
    return view.localStorage;
  } catch {
    return null;
  }
}

export function readStoredThemeMode(storage: Storage | null): ThemeMode {
  if (!storage) return DEFAULT_MODE;
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(value) ? value : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function writeThemeMode(storage: Storage | null, mode: ThemeMode): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}

function modeLabel(mode: ThemeMode): string {
  if (mode === 'auto') return '自动';
  if (mode === 'dark') return '深色';
  return '浅色';
}

function statusText(mode: ThemeMode, resolved: ResolvedTheme, unsaved: boolean): string {
  let label: string;
  if (mode === 'auto') {
    label = resolved === 'dark' ? '跟随时钟 · 深色' : '跟随时钟 · 浅色';
  } else if (resolved === 'dark') {
    label = '夜间手绘 · 深色';
  } else {
    label = '日间手绘 · 浅色';
  }
  return unsaved ? `${label}（仅本次有效）` : label;
}

export function initThemeController(
  doc: Document = document,
  options?: { trustHead?: boolean },
): () => void {
  const win = doc.defaultView;
  if (!win) return () => {};
  const view = win;

  const existing = controllers.get(doc);
  if (existing) {
    existing();
    controllers.delete(doc);
  }

  const storage = openStorage(view);
  const root = doc.documentElement;

  let mode: ThemeMode;
  let resolved: ResolvedTheme;
  let storageFailing = false;
  let minuteTimer: number | null = null;
  let minuteTimeout: number | null = null;
  let switchingTimer: number | null = null;

  const trustHead = options?.trustHead === true;
  const headTheme = root.getAttribute('data-theme');
  const headMode = root.getAttribute('data-theme-mode');

  if (trustHead && (headTheme === 'light' || headTheme === 'dark') && isThemeMode(headMode)) {
    mode = headMode;
    resolved = headTheme;
  } else {
    mode = readStoredThemeMode(storage);
    resolved = resolveTheme(mode, clockPrefersDark());
  }

  function syncLabels() {
    const buttons = doc.querySelectorAll<HTMLButtonElement>('[data-theme-choice]');
    for (const button of buttons) {
      const choice = button.getAttribute('data-theme-choice');
      const pressed = choice === mode;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }

    const triggers = doc.querySelectorAll<HTMLElement>('[data-theme-menu-trigger]');
    const current = modeLabel(mode);
    for (const trigger of triggers) {
      trigger.setAttribute('aria-label', `切换主题，当前${current}`);
      const text = trigger.querySelector('[data-theme-menu-label]');
      if (text) text.textContent = `${current} ▾`;
    }

    const statuses = doc.querySelectorAll<HTMLElement>('[data-theme-status]');
    const message = statusText(mode, resolved, storageFailing);
    for (const status of statuses) {
      status.textContent = message;
    }
  }

  function apply(nextMode: ThemeMode, nextResolved: ResolvedTheme) {
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

    mode = nextMode;
    resolved = nextResolved;

    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = resolved;

    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);

    syncLabels();

    doc.dispatchEvent(
      new CustomEvent<ThemeChangeDetail>('yl-theme-change', {
        detail: { mode, resolved },
      }),
    );
  }

  function onButtonClick(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const menuTrigger = target.closest<HTMLButtonElement>('[data-theme-menu-trigger]');
    if (menuTrigger) {
      const wrap = menuTrigger.closest('[data-mobile-theme]');
      const options = wrap?.querySelector<HTMLElement>('[data-theme-menu]');
      if (!options) return;
      const open = options.hasAttribute('hidden');
      options.hidden = !open;
      menuTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }

    const toggleBtn = target.closest<HTMLButtonElement>('[data-theme-toggle]');
    if (toggleBtn) {
      const nextChoice: ThemeMode = resolved === 'dark' ? 'light' : 'dark';
      const ok = writeThemeMode(storage, nextChoice);
      storageFailing = !ok;
      apply(nextChoice, nextChoice);
      return;
    }

    const button = target.closest<HTMLButtonElement>('[data-theme-choice]');
    if (!button) return;
    const choice = button.getAttribute('data-theme-choice');
    if (!isThemeMode(choice)) return;

    const ok = writeThemeMode(storage, choice);
    storageFailing = !ok;
    apply(choice, resolveTheme(choice, clockPrefersDark()));

    const wrap = button.closest('[data-mobile-theme]');
    const options = wrap?.querySelector<HTMLElement>('[data-theme-menu]');
    const trigger = wrap?.querySelector<HTMLButtonElement>('[data-theme-menu-trigger]');
    if (options) options.hidden = true;
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }
  }

  function onPointerDown(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    doc.querySelectorAll('[data-mobile-theme]').forEach((wrap) => {
      if (wrap.contains(target)) return;
      const options = wrap.querySelector<HTMLElement>('[data-theme-menu]');
      const trigger = wrap.querySelector<HTMLButtonElement>('[data-theme-menu-trigger]');
      if (options && !options.hidden) options.hidden = true;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    doc.querySelectorAll('[data-mobile-theme]').forEach((wrap) => {
      const options = wrap.querySelector<HTMLElement>('[data-theme-menu]');
      const trigger = wrap.querySelector<HTMLButtonElement>('[data-theme-menu-trigger]');
      if (options && !options.hidden) {
        options.hidden = true;
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.focus();
      }
    });
  }

  function onClockTick() {
    if (mode !== 'auto') return;
    apply(mode, resolveTheme(mode, clockPrefersDark()));
  }

  function armClock() {
    if (minuteTimeout !== null) view.clearTimeout(minuteTimeout);
    if (minuteTimer !== null) view.clearInterval(minuteTimer);
    minuteTimeout = view.setTimeout(() => {
      onClockTick();
      minuteTimer = view.setInterval(onClockTick, 60_000);
    }, msUntilNextMinute());
  }

  function onStorageChange(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    const incoming = event.newValue;
    const nextMode: ThemeMode = isThemeMode(incoming) ? incoming : DEFAULT_MODE;
    apply(nextMode, resolveTheme(nextMode, clockPrefersDark()));
  }

  doc.addEventListener('click', onButtonClick);
  doc.addEventListener('pointerdown', onPointerDown);
  doc.addEventListener('keydown', onKeyDown);
  view.addEventListener('storage', onStorageChange);
  armClock();

  apply(mode, resolved);

  const cleanup = () => {
    doc.removeEventListener('click', onButtonClick);
    doc.removeEventListener('pointerdown', onPointerDown);
    doc.removeEventListener('keydown', onKeyDown);
    view.removeEventListener('storage', onStorageChange);
    if (minuteTimeout !== null) view.clearTimeout(minuteTimeout);
    if (minuteTimer !== null) view.clearInterval(minuteTimer);
    if (switchingTimer !== null) view.clearTimeout(switchingTimer);
    root.removeAttribute('data-theme-switching');
  };

  controllers.set(doc, cleanup);

  if (!lifecycleBound) {
    lifecycleBound = true;
    doc.addEventListener('astro:before-swap', () => {
      const active = controllers.get(document);
      if (active) {
        active();
        controllers.delete(document);
      }
    });
  }

  return cleanup;
}
