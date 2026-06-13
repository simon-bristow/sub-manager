import { Overlay } from '../components/Overlay';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase/config';
import { useTeamStore } from '../state/useTeamStore';
import { doSignOut } from '../firebase/auth';
import { useScreenStore } from '../state/useScreenStore';
import { useMatchStore } from '../state/useMatchStore';
import { APP_VERSION } from '../version';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function AboutOverlay({ visible, onDismiss }: Props) {
  const [user] = useAuthState(auth);
  const teamName = useTeamStore((s) => s.teamName);
  const teamLogo = useTeamStore((s) => s.teamLogo);
  const clearTeam = useTeamStore((s) => s.clear);
  const showScreen = useScreenStore((s) => s.show);
  const resetMatch = useMatchStore((s) => s.reset);

  const signOut = async () => {
    onDismiss();
    await doSignOut();
    clearTeam();
    resetMatch();
    showScreen('login');
  };

  return (
    <Overlay visible={visible} onBackdrop={onDismiss}>
      {teamLogo && <img id="about-logo" src={teamLogo} alt="" className="about-logo" />}
      <h2>Sub Manager</h2>
      <div className="about-version">{APP_VERSION}</div>
      <p>Signed in as <strong id="about-user">{user?.displayName ?? user?.email ?? ''}</strong></p>
      <p>Team: <strong id="about-team-name">{teamName ?? ''}</strong></p>
      <div className="overlay-actions">
        <button id="about-close-btn" onClick={onDismiss}>Close</button>
        <button id="about-signout-btn" className="danger" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </Overlay>
  );
}
