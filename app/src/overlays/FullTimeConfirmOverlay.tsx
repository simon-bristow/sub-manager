import { Overlay } from '../components/Overlay';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FullTimeConfirmOverlay({ visible, onCancel, onConfirm }: Props) {
  return (
    <Overlay visible={visible} onBackdrop={onCancel}>
      <h2>End the match?</h2>
      <p>This will record final time and write season stats.</p>
      <div className="overlay-actions">
        <button id="cancel-ft-btn" onClick={onCancel}>Cancel</button>
        <button id="confirm-ft-btn" className="primary" onClick={onConfirm}>End match</button>
      </div>
    </Overlay>
  );
}
