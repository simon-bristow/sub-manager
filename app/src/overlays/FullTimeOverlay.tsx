import { Overlay } from '../components/Overlay';
import { useMatchStore, liveTimeOnPitch, deriveMatchSeconds } from '../state/useMatchStore';
import { useScreenStore } from '../state/useScreenStore';
import { formatTime } from '../domain/timer';

interface Props {
  visible: boolean;
}

export function FullTimeOverlay({ visible }: Props) {
  const players = useMatchStore((s) => s.players);
  const reset = useMatchStore((s) => s.reset);
  const showScreen = useScreenStore((s) => s.show);

  // Compute final time-on-pitch.
  const state = useMatchStore.getState();
  const matchSeconds = deriveMatchSeconds(state.timerStartedAt, state.accumulatedSeconds);

  const sorted = players
    .map((p) => ({ ...p, finalTime: liveTimeOnPitch(p, matchSeconds) }))
    .sort((a, b) => b.finalTime - a.finalTime);
  const max = sorted[0]?.finalTime || 1;

  return (
    <Overlay visible={visible}>
      <h2>Full Time</h2>
      <p className="ft-sub">Minutes played per player</p>
      <table className="ft-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Mins</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="ft-table-body">
          {sorted.map((p) => {
            const pct = Math.round((p.finalTime / max) * 100);
            return (
              <tr key={p.id}>
                <td>
                  {p.isGK && <span className="gk-badge" style={{ marginRight: 5 }}>GK</span>}
                  {p.name}
                </td>
                <td className="ft-mins">{formatTime(p.finalTime)}</td>
                <td className="ft-bar-cell">
                  <div className="ft-bar-wrap">
                    <div className="ft-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="overlay-actions">
        <button
          id="view-season-btn"
          onClick={() => {
            showScreen('season');
          }}
        >
          Season Stats →
        </button>
        <button
          id="new-match-btn"
          className="primary"
          onClick={() => {
            reset();
            showScreen('match-setup');
          }}
        >
          New Match
        </button>
      </div>
    </Overlay>
  );
}
