import { create } from 'zustand';
import type { AppConfig } from '../../shared/types';
import { DEFAULT_CONFIG } from '../../shared/types';

/** Extract the version number from the raw string (e.g. "2.1.50 (Claude Code)" → "2.1.50"). */
function parseClaudeVersion(version: string | null): string | null {
  return version?.replace(/\s*\(.*\)/, '') || null;
}

/** Resolve the effective theme (dark or light) from config + system preference. */
function resolveTheme(theme: AppConfig['theme'], systemTheme: 'dark' | 'light'): 'dark' | 'light' {
  return theme === 'system' ? systemTheme : theme;
}

interface ConfigStore {
  config: AppConfig;
  claudeInfo: { found: boolean; path: string | null; version: string | null } | null;
  /** Pre-formatted display label for status bar */
  claudeVersionLabel: string;
  /** Just the version number, e.g. "2.1.51" */
  claudeVersionNumber: string | null;
  loading: boolean;
  settingsOpen: boolean;
  /** OS-reported color scheme (populated by Phase 4 nativeTheme IPC) */
  systemTheme: 'dark' | 'light';
  /** Effective theme after resolving 'system' → actual dark/light */
  resolvedTheme: 'dark' | 'light';

  loadConfig: () => Promise<void>;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
  detectClaude: () => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  setSystemTheme: (theme: 'dark' | 'light') => void;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: DEFAULT_CONFIG,
  claudeInfo: null,
  claudeVersionLabel: 'Claude Code',
  claudeVersionNumber: null,
  loading: false,
  settingsOpen: false,
  systemTheme: 'dark',
  resolvedTheme: resolveTheme(DEFAULT_CONFIG.theme, 'dark'),

  loadConfig: async () => {
    set({ loading: true });
    const [config, systemTheme] = await Promise.all([
      window.electronAPI.config.get(),
      window.electronAPI.theme.getSystem(),
    ]);
    const resolved = resolveTheme(config.theme, systemTheme);
    set({ config, loading: false, systemTheme, resolvedTheme: resolved });

    // Listen for OS theme changes (only set up once)
    window.electronAPI.theme.onSystemChange((theme) => {
      useConfigStore.getState().setSystemTheme(theme);
    });
  },

  updateConfig: async (partial) => {
    await window.electronAPI.config.set(partial);
    const config = await window.electronAPI.config.get();
    const resolved = resolveTheme(config.theme, get().systemTheme);
    set({ config, resolvedTheme: resolved });
  },

  detectClaude: async () => {
    const claudeInfo = await window.electronAPI.claude.detect();
    const ver = parseClaudeVersion(claudeInfo?.version ?? null);
    set({
      claudeInfo,
      claudeVersionLabel: ver ? `Claude Code | v${ver}` : 'Claude Code',
      claudeVersionNumber: ver,
    });
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  setSystemTheme: (theme) => {
    const resolved = resolveTheme(get().config.theme, theme);
    set({ systemTheme: theme, resolvedTheme: resolved });
  },
}));

// Sync resolved theme → localStorage + <html> class whenever it changes.
// Runs outside React render so the DOM is always in sync, including for
// the FOUC-prevention script on next load.
useConfigStore.subscribe((state, prevState) => {
  if (state.resolvedTheme !== prevState.resolvedTheme) {
    try { localStorage.setItem('kng-resolved-theme', state.resolvedTheme); } catch {}
    document.documentElement.classList.toggle('theme-light', state.resolvedTheme === 'light');
  }
});
