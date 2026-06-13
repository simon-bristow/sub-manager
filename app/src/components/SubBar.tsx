import { useMatchStore } from '../state/useMatchStore';

export function SubBar() {
  const pendingOn = useMatchStore((s) => s.pendingOn);
  const pendingOff = useMatchStore((s) => s.pendingOff);
  const stagedSubs = useMatchStore((s) => s.stagedSubs);
  const players = useMatchStore((s) => s.players);
  const config = useMatchStore((s) => s.config);
  const removeStaged = useMatchStore((s) => s.removeStaged);
  const cancelStaging = useMatchStore((s) => s.cancelStaging);
  const confirmAll = useMatchStore((s) => s.confirmAll);

  const visible = pendingOn !== null || pendingOff !== null || stagedSubs.length > 0;
  if (!visible) return null;

  const onPitchCount = players.filter((p) => p.onPitch).length;
  const stagedSoloOn = stagedSubs.filter((s) => s.kind === 'fill').length;
  const slotsLeft =
    (config?.teamSize ?? 0) - onPitchCount - stagedSoloOn;

  return (
    <div id="sub-bar" className="sub-bar visible">
      <div className="sub-bar-header">
        <span>SUBSTITUTIONS</span>
        <div className="sub-bar-actions">
          <button className="cancel-sub-btn" onClick={cancelStaging}>✕</button>
          <button
            className="confirm-sub-btn"
            disabled={stagedSubs.length === 0}
            onClick={confirmAll}
          >
            Confirm All
          </button>
        </div>
      </div>
      <div id="staged-pairs" className="staged-pairs">
        {stagedSubs.map((sub, i) => {
          const onP = players.find((p) => p.id === sub.onId);
          if (!onP) return null;
          if (sub.kind === 'swap') {
            const offP = players.find((p) => p.id === sub.offId);
            return (
              <div key={i} className="staged-pair">
                <span className="pair-on">↑ {onP.name}</span>
                <span className="pair-arrow">/</span>
                <span className="pair-off">↓ {offP?.name ?? '?'}</span>
                <button className="pair-remove" onClick={() => removeStaged(i)}>✕</button>
              </div>
            );
          }
          return (
            <div key={i} className="staged-pair">
              <span className="pair-on">↑ {onP.name}</span>
              <span className="pair-arrow">→</span>
              <span className="pair-off" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                empty slot
              </span>
              <button className="pair-remove" onClick={() => removeStaged(i)}>✕</button>
            </div>
          );
        })}
      </div>
      {pendingOn !== null && (() => {
        const onP = players.find((p) => p.id === pendingOn);
        if (!onP) return null;
        const msg = slotsLeft > 0
          ? `↑ ${onP.name} coming on — tap a pitch player to swap, or tap an empty slot`
          : `↑ ${onP.name} coming on — now tap a pitch player to swap`;
        return <div id="pending-hint" className="pending-hint">{msg}</div>;
      })()}
      {pendingOff !== null && (() => {
        const offP = players.find((p) => p.id === pendingOff);
        if (!offP) return null;
        return (
          <div id="pending-hint" className="pending-hint">
            ↓ {offP.name} coming off — now tap a bench player to swap
          </div>
        );
      })()}
    </div>
  );
}
