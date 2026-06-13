import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MatchConfig, Player, PlayerSnapshot, StagedSub, SubLogEntry } from '../domain/types';

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
  pendingOn: string | null; // bench player tapped, waiting for a pitch player / empty slot
  pendingOff: string | null; // pitch player tapped, waiting for a bench player
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
  undoSubEvent: (index: number) => void;
  returnSubEventToStaging: (index: number) => void;

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
  | 'undoSubEvent'
  | 'returnSubEventToStaging'
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
  pendingOff: null,
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

        // Symmetric selection: the coach may start from either the pitch or
        // the bench. A swap is only staged once one of each is chosen.
        if (p.onPitch) {
          // pitch tap → candidate "coming off"
          if (s.pendingOff === id) {
            set({ pendingOff: null }); // toggle off
          } else if (s.pendingOn !== null) {
            // a bench player is already waiting → complete the swap
            set({
              stagedSubs: [...s.stagedSubs, { kind: 'swap', offId: id, onId: s.pendingOn }],
              pendingOn: null,
              pendingOff: null,
            });
          } else {
            set({ pendingOff: id }); // select (replacing any other pitch selection)
          }
        } else {
          // bench tap → candidate "coming on"
          if (s.pendingOn === id) {
            set({ pendingOn: null }); // toggle off
          } else if (s.pendingOff !== null) {
            // a pitch player is already waiting → complete the swap
            set({
              stagedSubs: [...s.stagedSubs, { kind: 'swap', offId: s.pendingOff, onId: id }],
              pendingOn: null,
              pendingOff: null,
            });
          } else {
            set({ pendingOn: id }); // select (replacing any other bench selection)
          }
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
          pendingOff: null,
        });
      },

      removeStaged: (index) => {
        const s = get();
        set({ stagedSubs: s.stagedSubs.filter((_, i) => i !== index) });
      },

      cancelStaging: () => set({ pendingOn: null, pendingOff: null, stagedSubs: [] }),

      confirmAll: () => {
        const s = get();
        if (s.stagedSubs.length === 0 || !s.config) return;
        const matchSeconds = deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
        const halfElapsed = matchSeconds - s.halfStartOffset;
        const minute =
          Math.floor(halfElapsed / 60) + (s.half - 1) * s.config.minutes;

        const updatedPlayers = s.players.map((p) => ({ ...p }));
        const pairs: SubLogEntry['pairs'] = [];
        // Capture the pre-confirm state of every player this event touches,
        // so the substitution can be undone or re-staged from the sub log.
        const affectedIds = new Set<string>();
        const snapshotOf = (id: string): PlayerSnapshot | null => {
          const p = s.players.find((x) => x.id === id);
          if (!p) return null;
          return {
            id: p.id,
            onPitch: p.onPitch,
            lastOnAt: p.lastOnAt,
            accumulatedTime: p.accumulatedTime,
            subCount: p.subCount,
            benchCount: p.benchCount,
          };
        };

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
          affectedIds.add(onP.id);
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
              offP.benchCount += 1; // player has hit the bench again
              affectedIds.add(offP.id);
              pairs.push({ onId: onP.id, onName: onP.name, offId: offP.id, offName: offP.name });
            }
          } else {
            pairs.push({ onId: onP.id, onName: onP.name, offId: null, offName: null });
          }
        }

        if (pairs.length === 0) {
          set({ stagedSubs: [], pendingOn: null, pendingOff: null });
          return;
        }

        const snapshot = [...affectedIds]
          .map(snapshotOf)
          .filter((s): s is PlayerSnapshot => s !== null);

        set({
          players: updatedPlayers,
          stagedSubs: [],
          pendingOn: null,
          pendingOff: null,
          subLog: [...s.subLog, { minute, pairs, snapshot }],
        });
      },

      undoSubEvent: (index) => {
        const s = get();
        const entry = s.subLog[index];
        if (!entry) return;
        const restored = s.players.map((p) => {
          const snap = entry.snapshot.find((x) => x.id === p.id);
          if (!snap) return p;
          return {
            ...p,
            onPitch: snap.onPitch,
            lastOnAt: snap.lastOnAt,
            accumulatedTime: snap.accumulatedTime,
            subCount: snap.subCount,
            benchCount: snap.benchCount,
          };
        });
        set({
          players: restored,
          subLog: s.subLog.filter((_, i) => i !== index),
        });
      },

      returnSubEventToStaging: (index) => {
        const s = get();
        const entry = s.subLog[index];
        if (!entry) return;
        // Restore players to their pre-confirm state…
        const restored = s.players.map((p) => {
          const snap = entry.snapshot.find((x) => x.id === p.id);
          if (!snap) return p;
          return {
            ...p,
            onPitch: snap.onPitch,
            lastOnAt: snap.lastOnAt,
            accumulatedTime: snap.accumulatedTime,
            subCount: snap.subCount,
            benchCount: snap.benchCount,
          };
        });
        // …and re-stage the pairs so the coach can adjust and re-confirm.
        const restaged: StagedSub[] = entry.pairs.map((pair) =>
          pair.offId
            ? { kind: 'swap', offId: pair.offId, onId: pair.onId }
            : { kind: 'fill', onId: pair.onId },
        );
        set({
          players: restored,
          subLog: s.subLog.filter((_, i) => i !== index),
          stagedSubs: [...s.stagedSubs, ...restaged],
          pendingOn: null,
          pendingOff: null,
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
          pendingOff: s.pendingOff === id ? null : s.pendingOff,
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
      version: 2,
      // Backfill benchCount for matches persisted before it existed: bench
      // players default to 1, pitch players to 0.
      migrate: (persisted, fromVersion) => {
        const st = persisted as MatchState;
        if (fromVersion < 2 && st && Array.isArray(st.players)) {
          st.players = st.players.map((p) => ({
            ...p,
            benchCount: p.benchCount ?? (p.onPitch ? 0 : 1),
          }));
        }
        return st;
      },
      // Don't persist the tick counter — it's just a re-render trigger.
      partialize: (s) => {
        const { tick: _tick, ...rest } = s;
        return rest;
      },
    },
  ),
);
