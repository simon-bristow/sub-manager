import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { handleRedirectResult } from './firebase/auth';
import { startFlushWorker } from './firebase/syncQueue';
import './styles.css';

// Start the offline-queue flush worker (30 s interval + online event).
startFlushWorker();

// Wait for any pending redirect sign-in to resolve before mounting the app.
// This prevents a flash of the login screen on iOS after a redirect auth flow.
handleRedirectResult().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
