/**
 * Theme state. The head anti-flash script in BlogLayout.astro duplicates the
 * key, the three exact mode strings, and the dark fallback. Keep them aligned.
 * theme-color hex values match --paper in global.css.
 */

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

function openColorSchemeQuery(view: Window): MediaQueryList | null {
  try {
    return view.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return null;
  }
}

function systemPrefersDark(media: MediaQueryList | null): boolean {
  if (!media) return true;
  try {
    return media.matches === true;
  } catch {
    return true;
  }
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}

function statusText(mode: ThemeMode, resolved: ResolvedTheme, unsaved: boolean): string {
  let label: string;
  if (mode === 'auto') {
    label = resolved === 'dark' ? '跟随系统 · 深色' : '跟随系统 · 浅色';
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
  const view = doc.defaultView;
  if (!view) return () => {};

  const existing = controllers.get(doc);
  if (existing) {
    existing();
    controllers.delete(doc);
  }

  const storage = openStorage(view);
  const media = openColorSchemeQuery(view);
  const root = doc.documentElement;

  let mode: ThemeMode;
  let resolved: ResolvedTheme;
  let storageFailing = false;

  const trustHead = options?.trustHead === true;
  const headTheme = root.getAttribute('data-theme');
  const headMode = root.getAttribute('data-theme-mode');

  if (trustHead && (headTheme === 'light' || headTheme === 'dark') && isThemeMode(headMode)) {
    mode = headMode;
    resolved = headTheme;
  } else {
    mode = readStoredThemeMode(storage);
    resolved = resolveTheme(mode, systemPrefersDark(media));
  }

  function apply(nextMode: ThemeMode, nextResolved: ResolvedTheme) {
    mode = nextMode;
    resolved = nextResolved;

    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = resolved;

    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);

    const buttons = doc.querySelectorAll<HTMLButtonElement>('[data-theme-choice]');
    for (const button of buttons) {
      const choice = button.getAttribute('data-theme-choice');
      const pressed = choice === mode;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }

    const statuses = doc.querySelectorAll<HTMLElement>('[data-theme-status]');
    const message = statusText(mode, resolved, storageFailing);
    for (const status of statuses) {
      status.textContent = message;
    }

    doc.dispatchEvent(
      new CustomEvent<ThemeChangeDetail>('yl-theme-change', {
        detail: { mode, resolved },
      }),
    );
  }

  function onButtonClick(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

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
    apply(choice, resolveTheme(choice, systemPrefersDark(media)));
  }

  function onMediaChange() {
    if (mode === 'auto') {
      apply(mode, resolveTheme(mode, systemPrefersDark(media)));
    }
  }

  function onStorageChange(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    const incoming = event.newValue;
    const nextMode: ThemeMode = isThemeMode(incoming) ? incoming : DEFAULT_MODE;
    apply(nextMode, resolveTheme(nextMode, systemPrefersDark(media)));
  }

  doc.addEventListener('click', onButtonClick);
  if (media) media.addEventListener('change', onMediaChange);
  view.addEventListener('storage', onStorageChange);

  apply(mode, resolved);

  const cleanup = () => {
    doc.removeEventListener('click', onButtonClick);
    if (media) media.removeEventListener('change', onMediaChange);
    view.removeEventListener('storage', onStorageChange);
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
