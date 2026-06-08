import { useEffect } from 'react';
import { useMatchStore, deriveMatchSeconds } from '../state/useMatchStore';

// Drives the once-per-second tick that re-runs selectors while the timer runs.
// Also handles automatic half/full-time triggers and sub-alert firing.
export function useTick(): void {
  const timerStartedAt = useMatchStore((s) => s.timerStartedAt);
  const matchOver = useMatchStore((s) => s.matchOver);

  useEffect(() => {
    if (timerStartedAt === null || matchOver) return;
    const id = setInterval(() => {
      useMatchStore.getState().bumpTick();
      checkAutoTriggers();
    }, 1000);

    // Also recompute on visibility change (recovering from a backgrounded tab).
    const onVis = () => {
      if (!document.hidden) {
        useMatchStore.getState().bumpTick();
        checkAutoTriggers();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [timerStartedAt, matchOver]);
}

function checkAutoTriggers(): void {
  const s = useMatchStore.getState();
  if (!s.config || s.matchOver || s.timerStartedAt === null) return;
  const matchSeconds = deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
  const halfElapsed = matchSeconds - s.halfStartOffset;
  const halfDuration = s.config.minutes * 60;

  // Sub alert.
  if (
    !s.subAlertDisabled &&
    !s.alertFiring &&
    matchSeconds >= s.nextAlertAt
  ) {
    fireBeep();
    s.fireSubAlert();
    setTimeout(() => useMatchStore.getState().clearSubAlert(), 4000);
  }

  // Half / full time.
  if (halfElapsed >= halfDuration) {
    if (s.half < s.config.periods) {
      // Pause and let HalfTimeOverlay handle the rest.
      const now = Date.now();
      const frozen =
        s.accumulatedSeconds + Math.floor((now - (s.timerStartedAt ?? now)) / 1000);
      useMatchStore.setState({ timerStartedAt: null, accumulatedSeconds: frozen });
    } else {
      s.endMatch();
    }
  }
}

function fireBeep(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // audio not supported
  }
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate([200, 100, 200]);
  }
}
