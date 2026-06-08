import { useEffect, useState } from 'react';
import { useTeamStore } from '../state/useTeamStore';
import { useScreenStore } from '../state/useScreenStore';
import { useMatchStore } from '../state/useMatchStore';
import { loadPlayersFromFirestore, resetSeasonStats } from '../firebase/teams';
import { Overlay } from '../components/Overlay';
import { Toast, showToast } from '../components/Toast';
import type { FirestorePlayer } from '../domain/types';

export function SeasonScreen() {
  const teamId = useTeamStore((s) => s.teamId);
  const teamName = useTeamStore((s) => s.teamName);
  const showScreen = useScreenStore((s) => s.show);
  const resetMatch = useMatchStore((s) => s.reset);
  const [players, setPlayers] = useState<FirestorePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetVisible, setResetVisible] = useState(false);

  const load = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const list = await loadPlayersFromFirestore(teamId);
      list.sort((a, b) => (b.seasonMinutes ?? 0) - (a.seasonMinutes ?? 0));
      setPlayers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const onResetConfirm = async () => {
    setResetVisible(false);
    if (!teamId) return;
    showToast('Resetting…');
    try {
      await resetSeasonStats(teamId);
      showToast('Stats reset ✓');
      await load();
    } catch {
      showToast('Reset failed');
    }
  };

  return (
    <div id="season-screen" className="screen season-screen">
      <Toast />
      <header className="season-header">
        <button
          id="season-back-btn"
          className="season-back-btn"
          onClick={() => showScreen('team-select')}
        >
          ← Back
        </button>
        <div className="season-header-text">
          <div id="season-team-name" className="season-team-name">{teamName ?? ''}</div>
          <div className="season-screen-sub">Season Stats</div>
        </div>
      </header>

      {loading ? (
        <div id="season-loading" className="season-loading">Loading…</div>
      ) : (
        <div id="season-content" className="season-content">
          <table className="season-table">
            <thead>
              <tr>
                <th>Player</th>
                <th className="right">Mins</th>
                <th className="right">Apps</th>
                <th className="right">Avg</th>
              </tr>
            </thead>
            <tbody id="season-table-body">
              {players.map((p) => {
                const mins = p.seasonMinutes ?? 0;
                const apps = p.appearances ?? 0;
                const avg = apps > 0 ? Math.round(mins / apps) : 0;
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="season-mins">{mins}'</td>
                    <td className="season-num">{apps}</td>
                    <td className="season-num">{avg}'</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            id="season-new-match-btn"
            className="season-new-match-btn"
            onClick={() => {
              resetMatch();
              showScreen('match-setup');
            }}
          >
            New Match
          </button>
          <button id="season-reset-btn" className="season-reset-btn" onClick={() => setResetVisible(true)}>
            Reset all stats…
          </button>
        </div>
      )}

      <Overlay visible={resetVisible} onBackdrop={() => setResetVisible(false)}>
        <h2>Reset season stats?</h2>
        <p>This sets every player's minutes and appearances back to zero.</p>
        <div className="overlay-actions">
          <button id="cancel-reset-season-btn" onClick={() => setResetVisible(false)}>
            Cancel
          </button>
          <button id="confirm-reset-season-btn" className="danger" onClick={() => void onResetConfirm()}>
            Reset
          </button>
        </div>
      </Overlay>
    </div>
  );
}
