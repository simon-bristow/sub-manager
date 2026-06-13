import { Overlay } from '../components/Overlay';
import { useMatchStore } from '../state/useMatchStore';

interface Props {
  index: number | null;
  onDismiss: () => void;
}

export function SubLogActionOverlay({ index, onDismiss }: Props) {
  const subLog = useMatchStore((s) => s.subLog);
  const undoSubEvent = useMatchStore((s) => s.undoSubEvent);
  const returnSubEventToStaging = useMatchStore((s) => s.returnSubEventToStaging);

  const entry = index !== null ? subLog[index] : null;
  const ons = entry ? entry.pairs.map((p) => p.onName) : [];
  const offs = entry ? entry.pairs.map((p) => p.offName).filter((n): n is string => !!n) : [];

  return (
    <Overlay visible={index !== null && !!entry} onBackdrop={onDismiss}>
      <h2>Substitution</h2>
      <p>Made at {entry?.minute}'</p>
      <div className="sub-action-summary">
        {ons.map((n, i) => (
          <span key={`on-${i}`} className="log-on">↑ {n}</span>
        ))}
        {offs.map((n, i) => (
          <span key={`off-${i}`} className="log-off">↓ {n}</span>
        ))}
      </div>
      <div className="overlay-actions vertical">
        <button
          className="danger"
          onClick={() => {
            if (index !== null) undoSubEvent(index);
            onDismiss();
          }}
        >
          Delete substitution
        </button>
        <button
          className="primary"
          onClick={() => {
            if (index !== null) returnSubEventToStaging(index);
            onDismiss();
          }}
        >
          Send back to staging
        </button>
        <button onClick={onDismiss}>Cancel</button>
      </div>
    </Overlay>
  );
}
