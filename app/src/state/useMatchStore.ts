import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MatchConfig, Player, StagedSub, SubLogEntry } from '../domain/types';

export type Screen =
  | 'login'
  | 'team-select'
  | 'match-setup'
  | 'squad-setup'
  | 'match'
  | 'season';

interface MatchState {
  // Frozen config + UUID at Start Match (so idempotency works).
  matchId: string | null;
  config: MatchConfig | null;
  players: Player[];

  // Timer state — wall-clock derivation.
  timerStartedAt: number | null; // epoch ms while running; null when paused
  accumulatedSeconds: number;
  half: number; // 1 or 2 (or 3 for 3-period mode)
  halfStartOffset: number; // matchSeconds at the start of the current half
  matchOver: boolean;
  fullTimeSaved: boolean; // idempotency guard for endMatch

  // Subs
  pendingOn: string | null;
  stagedSubs: StagedSub[];
  subLog: SubLogEntry[];

  // Alerts
  nextAlertAt: number;
  subAlertDisabled: boolean;
  alertFiring: boolean;

  // Tick counter — forces selector re-runs once per second while running.
  tick: number;

  // Actions
  startMatch: (args: { matchId: string; config: MatchConfig; players: Player[] }) => void;
  toggleTimer: () => void;
  bumpTick: () => void;
  beginSecondHalf: () => void;
  resumeFirstHalf: () => void;
  endMatch: () => void;
  markFullTimeSaved: () => void;
  reset: () => void;

  selectPlayer: (id: string) => void;
  stageEmptySlot: () => void;
  removeStaged: (index: number) => void;
  cancelStaging: () => void;
  confirmAll: () => void;

  setGK: (playerId: string) => void;
  addPlayer: (p: Player) => void;
  removePlayer: (id: string) => void;

  fireSubAlert: () => void;
  clearSubAlert: () => void;
  disableSubAlert: () => void;
}

const INITIAL: Omit<
  MatchState,
  | 'startMatch'
  | 'toggleTimer'
  | 'bumpTick'
  | 'beginSecondHalf'
  | 'resumeFirstHalf'
  | 'endMatch'
  | 'markFullTimeSaved'
  | 'reset'
  | 'selectPlayer'
  | 'stageEmptySlot'
  | 'removeStaged'
  | 'cancelStaging'
  | 'confirmAll'
  | 'setGK'
  | 'addPlayer'
  | 'removePlayer'
  | 'fireSubAlert'
  | 'clearSubAlert'
  | 'disableSubAlert'
> = {
  matchId: null,
  config: null,
  players: [],
  timerStartedAt: null,
  accumulatedSeconds: 0,
  half: 1,
  halfStartOffset: 0,
  matchOver: false,
  fullTimeSaved: false,
  pendingOn: null,
  stagedSubs: [],
  subLog: [],
  nextAlertAt: 0,
  subAlertDisabled: false,
  alertFiring: false,
  tick: 0,
};

// Helper: live matchSeconds at a given wall time, given store snapshot fields.
export function deriveMatchSeconds(
  timerStartedAt: number | null,
  accumulatedSeconds: number,
  now = Date.now(),
): number {
  if (timerStartedAt === null) return accumulatedSeconds;
  return accumulatedSeconds + Math.floor((now - timerStartedAt) / 1000);
}

export function liveTimeOnPitch(p: Player, matchSeconds: number): number {
  if (p.lastOnAt === null) return p.accumulatedTime;
  return p.accumulatedTime + Math.max(0, matchSeconds - p.lastOnAt);
}

export const useMatchStore = create<MatchState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      startMatch: ({ matchId, config, players }) =>
        set({
          ...INITIAL,
          matchId,
          config,
          players,
          nextAlertAt: config.alertMins * 60,
        }),

      toggleTimer: () => {
        const s = get();
        if (s.matchOver) return;
        const matchSeconds = deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
        if (s.timerStartedAt === null) {
          // start
          set({ timerStartedAt: Date.now(), accumulatedSeconds: matchSeconds });
        } else {
          // pause
          set({ timerStartedAt: null, accumulatedSeconds: matchSeconds });
        }
      },

      bumpTick: () => set((s) => ({ tick: s.tick + 1 })),

      beginSecondHalf: () => {
        const s = get();
        if (!s.config) return;
        const matchSeconds = deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
        set({
          half: s.half + 1,
          halfStartOffset: matchSeconds,
          nextAlertAt: matchSeconds + s.config.alertMins * 60,
          timerStartedAt: Date.now(),
          accumulatedSeconds: matchSeconds,
        });
      },

      resumeFirstHalf: () => {
        set({ timerStartedAt: Date.now() });
      },

      endMatch: () => {
        const s = get();
        const matchSeconds = deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
        // Stop the clock & freeze accumulator at the moment of end.
        set({ timerStartedAt: null, accumulatedSeconds: matchSeconds, matchOver: true });
      },

      markFullTimeSaved: () => set({ fullTimeSaved: true }),

      reset: () => set({ ...INITIAL }),

      selectPlayer: (id) => {
        const s = get();
        if (s.matchOver) return;
        const p = s.players.find((x) => x.id === id);
        if (!p) return;

        // Tap-to-un-stage: if this player is part of a staged pair, remove it.
        const stagedIdx = s.stagedSubs.findIndex((sub) => {
          if (sub.kind === 'swap') return sub.offId === id || sub.onId === id;
          return sub.onId === id;
        });
        if (stagedIdx !== -1) {
          set({ stagedSubs: s.stagedSubs.filter((_, i) => i !== stagedIdx) });
          return;
        }

        if (!p.onPitch) {
          // bench tap
          if (s.pendingOn === id) {
            set({ pendingOn: null });
          } else {
            set({ pendingOn: id });
          }
        } else {
          // pitch tap
          if (s.pendingOn !== null) {
            set({
              stagedSubs: [...s.stagedSubs, { kind: 'swap', offId: id, onId: s.pendingOn }],
              pendingOn: null,
            });
          }
          // else: no-op (need to select a bench player first)
        }
      },

      stageEmptySlot: () => {
        const s = get();
        if (s.pendingOn === null || !s.config) return;
        // Guard: don't allow fills that would exceed team size
        const currentOnPitch = s.players.filter((p) => p.onPitch).length;
        const stagedFills = s.stagedSubs.filter((sub) => sub.kind === 'fill').length;
        if (currentOnPitch + stagedFills >= s.config.teamSize) return;
        set({
          stagedSubs: [...s.stagedSubs, { kind: 'fill', onId: s.pendingOn }],
          pendingOn: null,
        });
      },

      removeStaged: (index) => {
        const s = get();
        set({ stagedSubs: s.stagedSubs.filter((_, i) => i !== index) });
      },

      cancelStaging: () => set({ pendingOn: null, stagedSubs: [] }),

      confirmAll: () => {
        const s = get();
        if (s.stagedSubs.length === 0 || !s.config) return;
        const matchSeconds = deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
        const halfElapsed = matchSeconds - s.halfStartOffset;
        const minute =
          Math.floor(halfElapsed / 60) + (s.half - 1) * s.config.minutes;

        const updatedPlayers = s.players.map((p) => ({ ...p }));
        const pairs: { onName: string; offName: string | null }[] = [];

        for (const sub of s.stagedSubs) {
          const onP = updatedPlayers.find((p) => p.id === sub.onId);
          if (!onP) continue;
          // Safety: skip fill subs that would exceed team size
          if (sub.kind === 'fill') {
            const currentOnPitch = updatedPlayers.filter((p) => p.onPitch).length;
            if (currentOnPitch >= s.config.teamSize) continue;
          }
          onP.onPitch = true;
          onP.lastOnAt = matchSeconds;
          onP.subCount += 1;
          if (sub.kind === 'swap') {
            const offP = updatedPlayers.find((p) => p.id === sub.offId);
            if (offP) {
              // Freeze the off player's time.
              if (offP.lastOnAt !== null) {
                offP.accumulatedTime += Math.max(0, matchSeconds - offP.lastOnAt);
              }
              offP.onPitch = false;
              offP.lastOnAt = null;
              offP.subCount += 1;
              pairs.push({ onName: onP.name, offName: offP.name });
            }
          } else {
            pairs.push({ onName: onP.name, offName: null });
          }
        }

        set({
          players: updatedPlayers,
          stagedSubs: [],
          pendingOn: null,
          subLog: [...s.subLog, { minute, pairs }],
        });
      },

      setGK: (playerId) => {
        const s = get();
        set({
          players: s.players.map((p) => ({ ...p, isGK: p.id === playerId })),
        });
      },

      addPlayer: (p) => {
        const s = get();
        set({ players: [...s.players, p] });
      },

      removePlayer: (id) => {
        const s = get();
        const filteredStaged = s.stagedSubs.filter((sub) => {
          if (sub.kind === 'swap') return sub.offId !== id && sub.onId !== id;
          return sub.onId !== id;
        });
        set({
          players: s.players.filter((p) => p.id !== id),
          stagedSubs: filteredStaged,
          pendingOn: s.pendingOn === id ? null : s.pendingOn,
        });
      },

      fireSubAlert: () => set({ alertFiring: true }),

      clearSubAlert: () => {
        const s = get();
        if (!s.config) return;
        const matchSeconds = deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
        set({
          alertFiring: false,
          nextAlertAt: matchSeconds + s.config.alertMins * 60,
        });
      },

      disableSubAlert: () => set({ subAlertDisabled: true, alertFiring: false }),
    }),
    {
      name: 'submanager_match',
      version: 1,
      // Don't persist the tick counter — it's just a re-render trigger.
      partialize: (s) => {
        const { tick: _tick, ...rest } = s;
        return rest;
      },
    },
  ),
);
