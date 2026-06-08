import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MatchConfig } from '../domain/types';
import { DEFAULT_CONFIG } from '../domain/types';
import { sanitizeConfig } from '../domain/validation';

interface ConfigState {
  config: MatchConfig;
  setConfig: (partial: Partial<MatchConfig>) => void;
  reset: () => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_CONFIG },
      setConfig: (partial) => set({ config: { ...get().config, ...partial } }),
      reset: () => set({ config: { ...DEFAULT_CONFIG } }),
    }),
    {
      name: 'submanager_matchconfig',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) state.config = sanitizeConfig(state.config);
      },
    },
  ),
);
