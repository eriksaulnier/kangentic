import { create } from 'zustand';
import type { AppConfig } from '../../shared/types';
import { DEFAULT_CONFIG } from '../../shared/types';

interface ConfigStore {
  config: AppConfig;
  claudeInfo: { found: boolean; path: string | null; version: string | null } | null;
  loading: boolean;
  settingsOpen: boolean;

  loadConfig: () => Promise<void>;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
  detectClaude: () => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: DEFAULT_CONFIG,
  claudeInfo: null,
  loading: false,
  settingsOpen: false,

  loadConfig: async () => {
    set({ loading: true });
    const config = await window.electronAPI.config.get();
    set({ config, loading: false });
  },

  updateConfig: async (partial) => {
    await window.electronAPI.config.set(partial);
    const config = await window.electronAPI.config.get();
    set({ config });
  },

  detectClaude: async () => {
    const claudeInfo = await window.electronAPI.claude.detect();
    set({ claudeInfo });
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
