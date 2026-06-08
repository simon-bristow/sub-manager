import { Overlay } from '../components/Overlay';
import { useMatchStore } from '../state/useMatchStore';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function HalfTimeOverlay({ visible, onDismiss }: Props) {
  const beginSecondHalf = useMatchStore((s) => s.beginSecondHalf);
  const resumeFirstHalf = useMatchStore((s) => s.resumeFirstHalf);

  return (
    <Overlay visible={visible}>
      <h2>Half Time</h2>
      <div className="overlay-actions vertical">
        <button
          id="start-second-btn"
          className="primary"
          onClick={() => {
            beginSecondHalf();
            onDismiss();
          }}
        >
          Start 2nd Half
        </button>
        <button
          id="resume-first-half-btn"
          onClick={() => {
            resumeFirstHalf();
            onDismiss();
          }}
        >
          Resume 1st Half
        </button>
        <button id="stay-halftime-btn" onClick={onDismiss}>
          Stay at Half Time
        </button>
      </div>
    </Overlay>
  );
}
