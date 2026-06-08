import { useMemo, useState, useEffect } from 'react';
import { Overlay } from '../components/Overlay';
import { useMatchStore, liveTimeOnPitch, deriveMatchSeconds } from '../state/useMatchStore';
import { buildRecommendations } from '../domain/recommend';
import { formatTime } from '../domain/timer';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function SuggestionsOverlay({ visible, onDismiss }: Props) {
  const players = useMatchStore((s) => s.players);
  const stagedSubs = useMatchStore((s) => s.stagedSubs);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (visible) setSelected(new Set());
  }, [visible]);

  const matchSeconds = useMemo(() => {
    const s = useMatchStore.getState();
    return deriveMatchSeconds(s.timerStartedAt, s.accumulatedSeconds);
  }, [visible]);

  const suggestions = useMemo(
    () => (visible ? buildRecommendations(players, matchSeconds, 4) : []),
    [visible, players, matchSeconds],
  );

  const isAlreadyStaged = (offId: string, onId: string) =>
    stagedSubs.some((s) => {
      if (s.kind === 'swap') return s.offId === offId || s.onId === onId;
      return s.onId === onId;
    });

  const toggle = (i: number) => {
    const s = suggestions[i];
    if (!s) return;
    if (isAlreadyStaged(s.offId, s.onId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const stage = () => {
    const store = useMatchStore.getState();
    const newPairs = [...store.stagedSubs];
    selected.forEach((i) => {
      const sug = suggestions[i];
      if (!sug) return;
      if (isAlreadyStaged(sug.offId, sug.onId)) return;
      newPairs.push({ kind: 'swap', offId: sug.offId, onId: sug.onId });
    });
    useMatchStore.setState({ stagedSubs: newPairs });
    setSelected(new Set());
    onDismiss();
  };

  return (
    <Overlay visible={visible} onBackdrop={onDismiss}>
      <h2>Suggested Subs</h2>
      <div id="rec-rows" className="rec-rows">
        {suggestions.length === 0 && <div className="rec-empty">No suggestions available.</div>}
        {suggestions.map((s, i) => {
          const off = players.find((p) => p.id === s.offId);
          const on = players.find((p) => p.id === s.onId);
          if (!off || !on) return null;
          const already = isAlreadyStaged(s.offId, s.onId);
          const sel = selected.has(i);
          return (
            <div
              key={i}
              className={`rec-row${sel ? ' selected' : ''}${already ? ' already' : ''}`}
              onClick={() => toggle(i)}
            >
              <div className="rec-check">{sel || already ? '✓' : ''}</div>
              <div className="rec-off">
                <div className="rec-name">{off.name}</div>
                <div className="rec-time">{formatTime(liveTimeOnPitch(off, matchSeconds))}</div>
              </div>
              <div className="rec-arrow">⇄</div>
              <div className="rec-on">
                <div className="rec-name">{on.name}</div>
                <div className="rec-time">{formatTime(liveTimeOnPitch(on, matchSeconds))}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="overlay-actions">
        <button id="rec-close-btn" onClick={onDismiss}>Close</button>
        <button
          id="rec-stage-btn"
          className="primary"
          disabled={selected.size === 0}
          onClick={stage}
        >
          Stage Selected ({selected.size})
        </button>
      </div>
    </Overlay>
  );
}
