// Core domain types for Sub Manager.

export interface MatchConfig {
  periods: 1 | 2 | 3;
  minutes: number;
  teamSize: number;
  alertMins: number;
}

export const DEFAULT_CONFIG: MatchConfig = {
  periods: 2,
  minutes: 45,
  teamSize: 11,
  alertMins: 10,
};

// Roster entry — exists during squad setup.
export interface RosterEntry {
  name: string;
  group: 'pitch' | 'bench' | 'absent';
  firestoreId: string | null;
}

// In-match player.
export interface Player {
  id: string;
  firestoreId: string | null;
  name: string;
  isGK: boolean;
  onPitch: boolean;
  // accumulatedTime: seconds frozen from prior on-pitch stints
  accumulatedTime: number;
  // lastOnAt: matchSeconds when they came on (null while on bench)
  lastOnAt: number | null;
  subCount: number;
  // benchCount: number of times the player has been on the bench — starts at 1
  // for players who begin on the bench, +1 each time they're subbed off.
  benchCount: number;
}

// Substitution staging.
export type StagedSub =
  | { kind: 'swap'; offId: string; onId: string }
  | { kind: 'fill'; onId: string };

// Snapshot of one player's tracking state, captured before a Confirm All so
// the substitution can be reversed if it was made in error.
export interface PlayerSnapshot {
  id: string;
  onPitch: boolean;
  lastOnAt: number | null;
  accumulatedTime: number;
  subCount: number;
  benchCount: number;
}

// Substitution log entry — one per Confirm All.
export interface SubLogEntry {
  minute: number;
  pairs: { onId: string; onName: string; offId: string | null; offName: string | null }[];
  // Pre-confirm state of every player this event touched (on + off players).
  // Used to undo or re-stage the event from the sub log.
  snapshot: PlayerSnapshot[];
}

// Firestore team document shape.
export interface Team {
  id: string;
  name: string;
  managerId: string;
  logoDataUrl?: string;
}

// Firestore player document shape.
export interface FirestorePlayer {
  id: string;
  name: string;
  seasonMinutes: number;
  appearances: number;
}

// Pending Firestore save (offline queue).
export interface PendingSave {
  matchId: string;
  teamId: string;
  payload: {
    date: number;
    halfLength: number;
    halves: number;
    teamSize: number;
    playerStats: Record<string, { minutesPlayed: number; subCount: number }>;
  };
  playerIncrements: Record<string, { minutes: number }>;
  attempts: number;
  lastError?: string;
  queuedAt: number;
}
