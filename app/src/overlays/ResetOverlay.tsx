import { Overlay } from '../components/Overlay';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResetOverlay({ visible, onCancel, onConfirm }: Props) {
  return (
    <Overlay visible={visible} onBackdrop={onCancel}>
      <h2>Discard match?</h2>
      <p>This clears the current match. The roster and season stats are unaffected.</p>
      <div className="overlay-actions">
        <button id="cancel-reset-btn" onClick={onCancel}>Cancel</button>
        <button id="confirm-reset-btn" className="danger" onClick={onConfirm}>Discard</button>
      </div>
    </Overlay>
  );
}
