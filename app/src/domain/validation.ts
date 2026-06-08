import type { MatchConfig } from './types';
import { DEFAULT_CONFIG } from './types';

export const BOUNDS = {
  periods: { min: 1, max: 3 },
  minutes: { min: 1, max: 60 },
  teamSize: { min: 3, max: 11 },
  alertMins: { min: 1, max: 60 },
};

export function configErrors(c: MatchConfig): Partial<Record<keyof MatchConfig, string>> {
  const e: Partial<Record<keyof MatchConfig, string>> = {};
  if (c.periods < BOUNDS.periods.min || c.periods > BOUNDS.periods.max)
    e.periods = `Halves must be ${BOUNDS.periods.min}–${BOUNDS.periods.max}.`;
  if (c.minutes < BOUNDS.minutes.min || c.minutes > BOUNDS.minutes.max)
    e.minutes = `Minutes per half must be ${BOUNDS.minutes.min}–${BOUNDS.minutes.max}.`;
  if (c.teamSize < BOUNDS.teamSize.min || c.teamSize > BOUNDS.teamSize.max)
    e.teamSize = `Team size must be ${BOUNDS.teamSize.min}–${BOUNDS.teamSize.max}.`;
  if (c.alertMins < BOUNDS.alertMins.min || c.alertMins > BOUNDS.alertMins.max)
    e.alertMins = `Sub alert must be ${BOUNDS.alertMins.min}–${BOUNDS.alertMins.max}.`;
  else if (c.alertMins > c.minutes)
    e.alertMins = 'Sub alert must be ≤ minutes per half.';
  return e;
}

export function configIsValid(c: MatchConfig): boolean {
  return Object.keys(configErrors(c)).length === 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function sanitizeConfig(c: Partial<MatchConfig> | undefined | null): MatchConfig {
  const src = { ...DEFAULT_CONFIG, ...(c ?? {}) };
  return {
    periods: clamp(src.periods, BOUNDS.periods.min, BOUNDS.periods.max) as MatchConfig['periods'],
    minutes: clamp(src.minutes, BOUNDS.minutes.min, BOUNDS.minutes.max),
    teamSize: clamp(src.teamSize, BOUNDS.teamSize.min, BOUNDS.teamSize.max),
    alertMins: Math.min(
      clamp(src.alertMins, BOUNDS.alertMins.min, BOUNDS.alertMins.max),
      clamp(src.minutes, BOUNDS.minutes.min, BOUNDS.minutes.max),
    ),
  };
}
