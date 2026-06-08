import type { PendingSave } from '../domain/types';
import { saveMatchResult } from './teams';

const KEY = 'submanager_pending_saves';

function read(): PendingSave[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: PendingSave[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function enqueue(save: PendingSave): void {
  const items = read();
  // Replace if already queued (same matchId).
  const next = items.filter((s) => s.matchId !== save.matchId);
  next.push(save);
  write(next);
  notify();
}

export function getPending(): PendingSave[] {
  return read();
}

export function pendingCount(): number {
  return read().length;
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function subscribePending(listener: Listener): () => void {
  listeners.add(listener);
  listener(pendingCount());
  return () => listeners.delete(listener);
}

function notify(): void {
  const count = pendingCount();
  listeners.forEach((l) => l(count));
}

let flushing = false;

export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const items = read();
    if (items.length === 0) return;
    const remaining: PendingSave[] = [];
    for (const item of items) {
      try {
        await saveMatchResult({
          teamId: item.teamId,
          matchId: item.matchId,
          halfLength: item.payload.halfLength,
          halves: item.payload.halves,
          teamSize: item.payload.teamSize,
          playerStats: item.payload.playerStats,
        });
      } catch (e) {
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          lastError: (e as Error).message ?? 'unknown',
        });
      }
    }
    write(remaining);
    notify();
  } finally {
    flushing = false;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let onlineHandler: (() => void) | null = null;

export function startFlushWorker(): void {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    if (navigator.onLine) void flushQueue();
  }, 30_000);
  onlineHandler = () => void flushQueue();
  window.addEventListener('online', onlineHandler);
  // Kick once on startup.
  if (navigator.onLine) void flushQueue();
}

export function stopFlushWorker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
}
