import { create } from 'zustand';

interface TeamState {
  teamId: string | null;
  teamName: string | null;
  teamLogo: string | null;
  setTeam: (id: string | null, name: string | null, logo: string | null) => void;
  clear: () => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  teamId: null,
  teamName: null,
  teamLogo: null,
  setTeam: (teamId, teamName, teamLogo) => set({ teamId, teamName, teamLogo }),
  clear: () => set({ teamId: null, teamName: null, teamLogo: null }),
}));
