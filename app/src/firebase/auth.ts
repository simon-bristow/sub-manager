import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth, googleProvider } from './config';

function isStandalone(): boolean {
  return (
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

function isMobileBrowser(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !isStandalone();
}

export async function signIn(): Promise<void> {
  // Standalone PWA (home-screen app): signInWithRedirect navigates out to
  // Safari and can't return to the PWA. Use popup — it opens an in-app
  // browser overlay that returns control to the PWA.
  // Mobile browser (not standalone): popups open as new tabs and cross-tab
  // communication fails silently. Use redirect.
  // Desktop: popup, with redirect fallback.
  if (isMobileBrowser()) {
    await signInWithRedirect(auth, googleProvider);
    return;
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleProvider);
    } else {
      throw e;
    }
  }
}

export async function handleRedirectResult(): Promise<void> {
  try {
    await getRedirectResult(auth);
  } catch {
    // Silently ignore — useAuthState will pick up the user if present.
  }
}

export async function doSignOut(): Promise<void> {
  await signOut(auth);
}
