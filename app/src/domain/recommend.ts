import type { Player } from './types';
import { liveTimeOnPitch } from '../state/useMatchStore';

export interface Suggestion {
  offId: string;
  onId: string;
}

export function buildRecommendations(
  players: Player[],
  matchSeconds: number,
  maxPairs = 4,
): Suggestion[] {
  // GK excluded from both sides.
  const offCandidates = players
    .filter((p) => p.onPitch && !p.isGK)
    .sort((a, b) => liveTimeOnPitch(b, matchSeconds) - liveTimeOnPitch(a, matchSeconds));
  const onCandidates = players
    .filter((p) => !p.onPitch && !p.isGK)
    .sort((a, b) => liveTimeOnPitch(a, matchSeconds) - liveTimeOnPitch(b, matchSeconds));
  const pairs = Math.min(offCandidates.length, onCandidates.length, maxPairs);
  const out: Suggestion[] = [];
  for (let i = 0; i < pairs; i++) {
    out.push({ offId: offCandidates[i].id, onId: onCandidates[i].id });
  }
  return out;
}
