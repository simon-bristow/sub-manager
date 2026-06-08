import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  increment,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { FirestorePlayer, Team } from '../domain/types';

export async function loadUserTeams(uid: string): Promise<Team[]> {
  const q = query(collection(db, 'teams'), where('managerId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Team, 'id'>) }));
}

export async function createTeam(
  name: string,
  managerId: string,
  logoDataUrl: string | null,
): Promise<string> {
  const data: Record<string, unknown> = {
    name,
    managerId,
    createdAt: serverTimestamp(),
  };
  if (logoDataUrl) data.logoDataUrl = logoDataUrl;
  const ref = await addDoc(collection(db, 'teams'), data);
  return ref.id;
}

export async function renameTeam(teamId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { name });
}

export async function updateTeamLogo(teamId: string, logoDataUrl: string): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { logoDataUrl });
}

export async function deleteTeam(teamId: string): Promise<void> {
  const playersSnap = await getDocs(collection(db, 'teams', teamId, 'players'));
  const batch = writeBatch(db);
  playersSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'teams', teamId));
  await batch.commit();
}

export async function loadPlayersFromFirestore(teamId: string): Promise<FirestorePlayer[]> {
  const snap = await getDocs(
    query(collection(db, 'teams', teamId, 'players'), orderBy('createdAt')),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name as string,
      seasonMinutes: (data.seasonMinutes as number) || 0,
      appearances: (data.appearances as number) || 0,
    };
  });
}

export async function addPlayerToTeam(teamId: string, name: string): Promise<string> {
  const ref = await addDoc(collection(db, 'teams', teamId, 'players'), {
    name,
    seasonMinutes: 0,
    appearances: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function removePlayerFromTeam(teamId: string, firestoreId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'players', firestoreId));
}

export async function resetSeasonStats(teamId: string): Promise<void> {
  const players = await loadPlayersFromFirestore(teamId);
  const batch = writeBatch(db);
  players.forEach((p) => {
    batch.update(doc(db, 'teams', teamId, 'players', p.id), {
      seasonMinutes: 0,
      appearances: 0,
    });
  });
  await batch.commit();
}

// Idempotent full-time write: returns true if the write was applied, false if a
// matches/{matchId} document already exists (already saved on a prior attempt).
export async function saveMatchResult(args: {
  teamId: string;
  matchId: string;
  halfLength: number;
  halves: number;
  teamSize: number;
  playerStats: Record<string, { minutesPlayed: number; subCount: number }>;
}): Promise<boolean> {
  const matchRef = doc(db, 'teams', args.teamId, 'matches', args.matchId);
  const existing = await getDoc(matchRef);
  if (existing.exists()) return false;

  await setDoc(matchRef, {
    date: serverTimestamp(),
    halfLength: args.halfLength,
    halves: args.halves,
    teamSize: args.teamSize,
    playerStats: args.playerStats,
  });

  const batch = writeBatch(db);
  Object.entries(args.playerStats).forEach(([playerId, stats]) => {
    batch.update(doc(db, 'teams', args.teamId, 'players', playerId), {
      seasonMinutes: increment(stats.minutesPlayed),
      appearances: increment(1),
    });
  });
  await batch.commit();
  return true;
}
