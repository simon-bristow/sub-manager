import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase/config';
import {
  loadUserTeams,
  createTeam,
  renameTeam,
  deleteTeam,
  updateTeamLogo,
} from '../firebase/teams';
import { doSignOut } from '../firebase/auth';
import { useTeamStore } from '../state/useTeamStore';
import { useScreenStore } from '../state/useScreenStore';
import { useMatchStore } from '../state/useMatchStore';
import type { Team } from '../domain/types';
import { resizeImageToDataUrl } from '../domain/image';
import { showToast, Toast } from '../components/Toast';
import { Overlay } from '../components/Overlay';

export function TeamSelectScreen() {
  const [user] = useAuthState(auth);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const setTeam = useTeamStore((s) => s.setTeam);
  const showScreen = useScreenStore((s) => s.show);
  const resetMatch = useMatchStore((s) => s.reset);

  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await loadUserTeams(user.uid);
      setTeams(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const select = (t: Team) => {
    setTeam(t.id, t.name, t.logoDataUrl ?? null);
    resetMatch();
    showScreen('match-setup');
  };

  const onCreateLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await resizeImageToDataUrl(f);
      setPendingLogo(url);
    } catch {
      /* ignore */
    }
  };

  const onCreate = async () => {
    if (!user) return;
    const name = newName.trim();
    if (!name) {
      setCreateError('Please enter a team name.');
      return;
    }
    setCreateError('');
    try {
      const id = await createTeam(name, user.uid, pendingLogo);
      setNewName('');
      setPendingLogo(null);
      setTeam(id, name, pendingLogo);
      resetMatch();
      showScreen('match-setup');
    } catch {
      setCreateError('Could not create team. Please try again.');
    }
  };

  const onConfirmRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError('Please enter a name.');
      return;
    }
    setRenameError('');
    try {
      await renameTeam(renameTarget.id, name);
      setRenameTarget(null);
      await reload();
    } catch {
      setRenameError('Could not rename. Please try again.');
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    showToast('Deleting…');
    try {
      await deleteTeam(id);
      showToast('Deleted ✓');
      await reload();
    } catch {
      showToast('Delete failed');
    }
  };

  const onChangeLogo = (id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      showToast('Saving logo…');
      try {
        const url = await resizeImageToDataUrl(f);
        await updateTeamLogo(id, url);
        showToast('Logo updated ✓');
        await reload();
      } catch {
        showToast('Logo update failed');
      }
    };
    input.click();
  };

  const onStats = (t: Team) => {
    setTeam(t.id, t.name, t.logoDataUrl ?? null);
    showScreen('season');
  };

  return (
    <div id="team-select-screen" className="screen team-select-screen">
      <Toast />
      <header className="team-select-header">
        <div className="team-select-header-text">
          <div className="setup-title">Choose a team</div>
          <div className="team-select-user" id="team-select-user">
            {user?.displayName ?? user?.email ?? ''}
          </div>
        </div>
        <button id="team-select-signout-btn" className="signout-btn" onClick={() => void doSignOut()}>
          Sign out
        </button>
      </header>

      <div id="team-list" className="team-list">
        {loading && teams.length === 0 && <div className="team-list-loading">Loading…</div>}
        {teams.map((t) => (
          <div key={t.id} className="team-card">
            <button className="team-card-select" onClick={() => select(t)}>
              {t.logoDataUrl && <img className="team-card-logo" src={t.logoDataUrl} alt="" />}
              <span className="team-card-name">{t.name}</span>
              <span className="team-card-arrow">›</span>
            </button>
            <div className="team-card-actions">
              <button className="team-action-btn" onClick={() => onStats(t)}>Stats</button>
              <button
                className="team-action-btn"
                onClick={() => {
                  setRenameTarget({ id: t.id, name: t.name });
                  setRenameValue(t.name);
                }}
              >
                Rename
              </button>
              <button className="team-action-btn" onClick={() => onChangeLogo(t.id)}>Logo</button>
              <button
                className="team-action-btn danger"
                onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="create-team-divider"><span>or</span></div>
      <div className="create-team-form">
        <input
          id="new-team-input"
          type="text"
          className="create-team-input"
          placeholder="Team name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onCreate();
          }}
        />
        <label className="logo-upload-btn">
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onCreateLogoChange} />
          {pendingLogo ? (
            <img id="team-logo-preview" src={pendingLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} />
          ) : (
            <span id="team-logo-status">🖼</span>
          )}
        </label>
        <button id="create-team-btn" className="create-team-btn" onClick={onCreate}>
          Create
        </button>
      </div>
      <div id="create-team-error" className="create-team-error">{createError}</div>

      <Overlay visible={!!renameTarget} onBackdrop={() => setRenameTarget(null)}>
        <h2>Rename team</h2>
        <input
          id="rename-team-input"
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onConfirmRename();
          }}
        />
        <div className="overlay-error">{renameError}</div>
        <div className="overlay-actions">
          <button onClick={() => setRenameTarget(null)}>Cancel</button>
          <button className="primary" onClick={() => void onConfirmRename()}>Save</button>
        </div>
      </Overlay>

      <Overlay visible={!!deleteTarget} onBackdrop={() => setDeleteTarget(null)}>
        <h2>Delete team?</h2>
        <p>
          This will permanently delete <strong>{deleteTarget?.name}</strong> and all of its players
          and season stats.
        </p>
        <div className="overlay-actions">
          <button onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="danger" onClick={() => void onConfirmDelete()}>Delete</button>
        </div>
      </Overlay>
    </div>
  );
}
