import { useEffect, useState } from 'react';
import { Overlay } from '../components/Overlay';
import { useMatchStore } from '../state/useMatchStore';
import { useTeamStore } from '../state/useTeamStore';
import { addPlayerToTeam } from '../firebase/teams';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function AddPlayerOverlay({ visible, onDismiss }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const players = useMatchStore((s) => s.players);
  const addPlayer = useMatchStore((s) => s.addPlayer);
  const teamId = useTeamStore((s) => s.teamId);

  useEffect(() => {
    if (visible) {
      setName('');
      setError('');
    }
  }, [visible]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name.');
      return;
    }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already in the squad.`);
      return;
    }
    let firestoreId: string | null = null;
    if (teamId) {
      try {
        firestoreId = await addPlayerToTeam(teamId, trimmed);
      } catch {
        /* non-fatal */
      }
    }
    const newId = `late-${Date.now()}`;
    addPlayer({
      id: newId,
      firestoreId,
      name: trimmed,
      isGK: false,
      onPitch: false,
      accumulatedTime: 0,
      lastOnAt: null,
      subCount: 0,
    });
    onDismiss();
  };

  return (
    <Overlay visible={visible} onBackdrop={onDismiss}>
      <h2>Add player</h2>
      <input
        id="late-player-input"
        type="text"
        placeholder="Player name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        autoFocus
      />
      <div id="late-player-error" className="overlay-error">{error}</div>
      <div className="overlay-actions">
        <button id="late-player-cancel-btn" onClick={onDismiss}>Cancel</button>
        <button id="late-player-confirm-btn" className="primary" onClick={() => void submit()}>
          Add
        </button>
      </div>
    </Overlay>
  );
}
