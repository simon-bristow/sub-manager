import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyAawVKpw7O_mLUv0zufs-0OaXr4dvFw-3I',
  authDomain: 'sub-manager-eb2b2.web.app',
  projectId: 'sub-manager-eb2b2',
  storageBucket: 'sub-manager-eb2b2.firebasestorage.app',
  messagingSenderId: '1059757889250',
  appId: '1:1059757889250:web:546e23cf8fb0b2fa1530bb',
};

export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export const db = getFirestore(fbApp);
export const googleProvider = new GoogleAuthProvider();
