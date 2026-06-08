import { create } from 'zustand';

export type Screen =
  | 'login'
  | 'team-select'
  | 'match-setup'
  | 'squad-setup'
  | 'match'
  | 'season';

interface ScreenState {
  screen: Screen;
  show: (screen: Screen) => void;
}

export const useScreenStore = create<ScreenState>((set) => ({
  screen: 'login',
  show: (screen) => set({ screen }),
}));
