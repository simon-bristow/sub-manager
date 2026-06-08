import { useMatchStore, deriveMatchSeconds } from '../state/useMatchStore';
import { formatTime } from '../domain/timer';

export function NextSubCountdown() {
  useMatchStore((s) => s.tick);
  const s = useMatchStore.getState();
  const nextAlertAt = useMatchStore((x) => x.nextAlertAt);
  const subAlertDisabled = useMatchStore((x) => x.subAlertDisabled);
  const matchOver = useMatchStore((x) => x.matchOver);
  const alertFiring = useMatchStore((x) => x.alertFiring);
  const disableSubAlert = useMatchStore((x) => x.disableSubAlert);

  if (matchOver || subAlertDisabled) return null;

  const matchSeconds = deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
  const remaining = Math.max(0, nextAlertAt - matchSeconds);
  const warning = !alertFiring && remaining > 0 && remaining <= 60;

  return (
    <div id="next-sub-row" className="next-sub-row">
      <div id="next-sub" className={`next-sub${warning ? ' warning' : ''}${alertFiring ? ' firing' : ''}`}>
        {alertFiring ? 'SUB NOW!' : `Next sub in ${formatTime(remaining)}`}
      </div>
      <button id="next-sub-dismiss" className="next-sub-dismiss" onClick={disableSubAlert}>
        ✕
      </button>
    </div>
  );
}
