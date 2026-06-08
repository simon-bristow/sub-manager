import { useMatchStore, deriveMatchSeconds } from '../state/useMatchStore';
import { formatTime } from '../domain/timer';

export function Clock() {
  useMatchStore((s) => s.tick);
  const { timerStartedAt, accumulatedSeconds, halfStartOffset, config } = useMatchStore(
    (s) => ({
      timerStartedAt: s.timerStartedAt,
      accumulatedSeconds: s.accumulatedSeconds,
      halfStartOffset: s.halfStartOffset,
      config: s.config,
    }),
  );
  if (!config) return null;
  const matchSeconds = deriveMatchSeconds(timerStartedAt, accumulatedSeconds);
  const halfElapsed = Math.min(matchSeconds - halfStartOffset, config.minutes * 60);
  const remaining = Math.max(0, config.minutes * 60 - (matchSeconds - halfStartOffset));
  return (
    <div className="clock-row">
      <div id="clock" className="clock">{formatTime(Math.max(0, halfElapsed))}</div>
      <div id="time-left" className="time-left">-{formatTime(remaining)}</div>
    </div>
  );
}
