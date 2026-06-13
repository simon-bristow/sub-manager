import { useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase/config';
import { useScreenStore } from './state/useScreenStore';
import { LoginScreen } from './screens/LoginScreen';
import { TeamSelectScreen } from './screens/TeamSelectScreen';
import { MatchSetupScreen } from './screens/MatchSetupScreen';
import { SquadSetupScreen } from './screens/SquadSetupScreen';
import { MatchScreen } from './screens/MatchScreen';
import { SeasonScreen } from './screens/SeasonScreen';
import { APP_VERSION } from './version';

export function App() {
  const [user, loading] = useAuthState(auth);
  const screen = useScreenStore((s) => s.screen);
  const show = useScreenStore((s) => s.show);

  // When auth resolves, navigate to team-select if logged in,
  // or back to login if signed out.
  useEffect(() => {
    if (loading) return;
    if (user && screen === 'login') {
      show('team-select');
    } else if (!user && screen !== 'login') {
      show('login');
    }
  }, [user, loading, screen, show]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">Loading…</div>
        <div className="version-badge">{APP_VERSION}</div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'login':
        return <LoginScreen />;
      case 'team-select':
        return <TeamSelectScreen />;
      case 'match-setup':
        return <MatchSetupScreen />;
      case 'squad-setup':
        return <SquadSetupScreen />;
      case 'match':
        return <MatchScreen />;
      case 'season':
        return <SeasonScreen />;
      default:
        return <LoginScreen />;
    }
  };

  return (
    <>
      {renderScreen()}
      <div className="version-badge">{APP_VERSION}</div>
    </>
  );
}
