import { useMemo } from 'react';
import type { Player } from '../domain/types';
import { useMatchStore, liveTimeOnPitch, deriveMatchSeconds } from '../state/useMatchStore';
import { formatTime } from '../domain/timer';
import { fatigueColor } from '../domain/fatigue';
import { useLongPress } from '../hooks/useLongPress';

interface Props {
  player: Player;
  onLongPress: (id: string) => void;
}

export function PlayerCard({ player, onLongPress }: Props) {
  useMatchStore((s) => s.tick); // re-render on each tick

  const matchSeconds = useMatchStore((s) =>
    deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds),
  );
  const allPlayers = useMatchStore((s) => s.players);
  const pendingOn = useMatchStore((s) => s.pendingOn);
  const pendingOff = useMatchStore((s) => s.pendingOff);
  const stagedSubs = useMatchStore((s) => s.stagedSubs);
  const selectPlayer = useMatchStore((s) => s.selectPlayer);

  const maxTime = useMemo(
    () => Math.max(1, ...allPlayers.map((p) => liveTimeOnPitch(p, matchSeconds))),
    [allPlayers, matchSeconds],
  );

  const live = liveTimeOnPitch(player, matchSeconds);

  const isStagedOff = stagedSubs.some((s) => s.kind === 'swap' && s.offId === player.id);
  const isStagedOn = stagedSubs.some((s) => s.onId === player.id);
  const isPendingOn = pendingOn === player.id;
  const isPendingOff = pendingOff === player.id;

  const handlers = useLongPress(
    () => onLongPress(player.id),
    () => selectPlayer(player.id),
  );

  const cls = [
    'player-card',
    player.onPitch ? 'on-pitch' : 'on-bench',
    isStagedOff || isPendingOff ? 'selected-off' : '',
    isStagedOn || isPendingOn ? 'selected-on' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} {...handlers}>
      {player.isGK && <span className="gk-badge">GK</span>}
      <span className="player-name">{player.name}</span>
      <span className="time-played" style={{ color: fatigueColor(live, maxTime) }}>
        {formatTime(live)}
      </span>
    </div>
  );
}
