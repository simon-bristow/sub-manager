import { Overlay } from '../components/Overlay';
import { useMatchStore } from '../state/useMatchStore';

interface Props {
  playerId: string | null;
  onDismiss: () => void;
}

export function PlayerOptionsOverlay({ playerId, onDismiss }: Props) {
  const players = useMatchStore((s) => s.players);
  const setGK = useMatchStore((s) => s.setGK);
  const removePlayer = useMatchStore((s) => s.removePlayer);
  const player = playerId ? players.find((p) => p.id === playerId) : null;
  const currentGk = players.find((p) => p.isGK);

  return (
    <Overlay visible={!!player} onBackdrop={onDismiss}>
      <h2 id="player-options-title">{player?.name ?? ''}</h2>
      <p id="player-options-sub">
        {player?.isGK ? (
          'This player is the current GK.'
        ) : currentGk ? (
          <>Current GK: <strong>{currentGk.name}</strong></>
        ) : (
          'No GK assigned.'
        )}
      </p>
      <div className="overlay-actions vertical">
        {player && !player.isGK && (
          <button
            id="switch-gk-btn"
            className="primary"
            onClick={() => {
              setGK(player.id);
              onDismiss();
            }}
          >
            Make GK
          </button>
        )}
        <button
          id="remove-player-btn"
          className="danger"
          onClick={() => {
            if (player) removePlayer(player.id);
            onDismiss();
          }}
        >
          Remove from match
        </button>
        <button id="player-options-cancel-btn" onClick={onDismiss}>
          Cancel
        </button>
      </div>
    </Overlay>
  );
}
