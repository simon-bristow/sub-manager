# Spec: Technical (React + Firebase rebuild)

## Goal

Rebuild Sub Manager as a React app with the same Firebase backend, preserving every behavior in the existing specs while replacing the single-file vanilla JS implementation with a modern, modular codebase. This document captures the technology choices, project structure, state model, and migration approach.

---

## Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React 18** with function components + hooks | Industry standard; concurrent rendering helps the once-per-second timer not jank scroll on mobile |
| Build tool | **Vite** | Fast dev server, native ESM, trivial Firebase Hosting deploy. No CRA. |
| Language | **TypeScript** (recommended) | The state machines (timer, sub staging, half transitions) are exactly where types prevent the bugs the current impl narrowly avoids. JS is acceptable if the team has no TS experience — keep the dependency tree smaller. |
| Routing | **No router** — a single `screen` state | The flow is a linear state machine (Login → TeamSelect → MatchSetup → SquadSetup → Match → FullTime). React Router adds weight for no URL-sharing benefit (no one deep-links into a live match). |
| State | **Zustand** for app-wide state, `useState` for local UI | See §3. Avoids prop drilling without Redux's ceremony. Built-in `persist` middleware solves match-state survival cleanly. |
| Firebase | **`firebase` v10 modular SDK** + **`react-firebase-hooks`** | Hooks (`useAuthState`, `useCollection`) replace the manual `onAuthStateChanged` / `getDocs` plumbing in `app.js`. |
| Styling | **Port existing `styles.css`** as-is for v1; consider CSS Modules per-component later | The current CSS is well-scoped via BEM-ish class names and works on 375px first try. Rewriting in Tailwind is a separate project. |
| Hosting | **Firebase Hosting** (recommended) | Same project as Firestore/Auth; cleaner CSP for `signInWithRedirect`; preview channels for PRs. GitHub Pages also works but the auth-redirect-domain config is fiddlier. |
| PWA | **`vite-plugin-pwa`** with `generateSW` mode | Sideline coaches benefit from "Add to Home Screen" and from the app surviving brief network drops. `navigateFallbackDenylist: [/^\/__\//]` ensures Firebase's `/__/auth/handler` is not intercepted by the service worker. |
| Testing | **Vitest** (unit) + **Playwright** (one mobile-viewport E2E for the substitution + half flow) | Test the reducers, not the components. |

---

## Project structure

```
sub-manager/
├── index.html
├── vite.config.ts
├── public/
│   ├── favicon.png
│   ├── apple-touch-icon.png
│   └── manifest.json
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # screen switcher
│   ├── firebase/
│   │   ├── config.ts            # firebaseConfig (gitignored secrets if rotated)
│   │   ├── auth.ts              # signIn/signOut wrappers
│   │   ├── teams.ts             # CRUD: teams, players, matches
│   │   └── hooks.ts             # useTeams, useRoster, useSeasonStats
│   ├── state/
│   │   ├── useMatchStore.ts     # Zustand: match runtime (timer, players, subs)
│   │   ├── useConfigStore.ts    # Zustand: match config (persisted to localStorage)
│   │   └── selectors.ts         # derived state (live timeOnPitch, sub bar, etc.)
│   ├── domain/
│   │   ├── timer.ts             # pure functions: currentMatchSeconds(), halfElapsed()
│   │   ├── substitutions.ts     # pure: applyConfirmAll(), stageSwap(), ...
│   │   ├── recommend.ts         # suggested-subs algorithm
│   │   └── types.ts             # Player, RosterEntry, StagedSub, SubLogEntry
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── TeamSelectScreen.tsx
│   │   ├── MatchSetupScreen.tsx
│   │   ├── SquadSetupScreen.tsx
│   │   ├── MatchScreen.tsx
│   │   ├── SeasonScreen.tsx
│   │   └── overlays/
│   │       ├── HalfTimeOverlay.tsx
│   │       ├── FullTimeOverlay.tsx
│   │       ├── ResetConfirmOverlay.tsx
│   │       ├── RecommendationsOverlay.tsx
│   │       ├── PlayerOptionsOverlay.tsx
│   │       └── AboutOverlay.tsx
│   ├── components/
│   │   ├── PlayerCard.tsx
│   │   ├── EmptySlotCard.tsx
│   │   ├── SubBar.tsx
│   │   ├── Clock.tsx
│   │   ├── NextSubCountdown.tsx
│   │   ├── DragLayer.tsx        # touch-drag ghost (squad setup)
│   │   └── LongPress.tsx        # shared 600ms long-press hook
│   └── styles/
│       └── styles.css           # ported from current root
```

Single-file `index.html` and the embedded base64 logo go away; the team logo is already stored in Firestore as a data URL on the team document.

---

## State management (the main ask)

### Three distinct lifetimes

| Lifetime | Examples | Where it lives |
|---|---|---|
| **Persistent (cross-session, cross-device)** | Teams, players (roster), season minutes, appearances, match history | **Firestore** — same schema as today |
| **User preferences (cross-session, this device)** | Match config defaults (`periods`, `minutes`, `teamSize`, `alertMins`) | **localStorage** — same as today's `submanager_matchconfig` key |
| **Live match state** | Timer, on-pitch flags, sub log, staged subs, GK assignment, `timeOnPitch` per player | **Zustand store, persisted to localStorage** (see below) |

### Recommendation: persist the live match to localStorage

The single highest-leverage change vs today's impl. A youth-coach's phone *will* lock, ring, or auto-update Chrome mid-match. Right now, a refresh nukes the match. With Zustand's `persist` middleware writing to `localStorage` on every change, recovery is automatic.

```ts
// state/useMatchStore.ts (sketch)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MatchState {
  // Setup snapshot (frozen at Start Match)
  config: { periods: number; minutes: number; teamSize: number; alertMins: number };
  players: Player[];
  gkId: string | null;

  // Timer (wall-clock derivation — see §5)
  timerStartedAt: number | null;   // epoch ms; null when paused
  accumulatedSeconds: number;       // frozen seconds while paused
  half: 1 | 2;
  halfStartOffset: number;          // matchSeconds at start of current half
  matchOver: boolean;

  // Per-player time tracking (refresh-safe model)
  // lastOnAt: matchSeconds at which the player most recently came on (null on bench)
  // accumulatedTime: frozen seconds from prior on-pitch stints

  // Subs
  pendingOn: string | null;
  stagedSubs: StagedSub[];
  subLog: SubLogEntry[];

  // Alerts
  nextAlertAt: number;
  subAlertDisabled: boolean;

  // Actions...
}

export const useMatchStore = create<MatchState>()(
  persist(
    (set, get) => ({ /* ... */ }),
    { name: 'submanager_match' }
  )
);
```

#### Why localStorage, not Firestore, for live match state

- **Cost & rate limits** — a 90-minute match firing a Firestore write every second is 5,400 writes/match. Firestore best-practice is < 1 sustained write per second per document.
- **Latency** — touch-to-update needs to be instant; Firestore round-trip on every sub would feel sluggish on flaky 4G.
- **No collaboration need** — `appspec.md` line 112 already states single-account; the coach is the sole writer.
- **Refresh recovery is the only real requirement** — localStorage solves that perfectly.

#### What gets written to Firestore from the match

- **On Confirm All** — *nothing*. The sub log stays local.
- **On Full Time** — one `matches` document (date, format, per-player minutes/subCount) + a batched increment of each player's `seasonMinutes` and `appearances`. Same as today.

This matches the current behavior, with the addition that the *local match* survives a refresh.

#### How "Reset" works

Clearing the Zustand store also clears the persisted slot. Add a one-tap confirmation (already in spec) before doing so — the persisted state is the only copy.

### Match config defaults — keep localStorage

No reason to change `submanager_matchconfig`. A small `useConfigStore` Zustand slice with `persist` does it without manual try/catch.

### Firestore access pattern

Use `react-firebase-hooks`:

```tsx
const [user, authLoading] = useAuthState(auth);
const [teamsSnap] = useCollection(query(collection(db, 'teams'), where('managerId', '==', user?.uid)));
```

For the roster on the active team, fetch once at "Select Team" and put it in local component state (no need for a live subscription — the coach is the only writer in this session). Same for season stats.

### What *not* to use

- **Context for everything** — Zustand selectors avoid the "everything re-renders when one field changes" footgun of `useContext`. Critical for the per-second timer (see §5).
- **Redux Toolkit** — overkill for one store, slows iteration.
- **TanStack Query** — would be nice for the Firestore reads, but Firestore's own caching plus react-firebase-hooks gets us 80% there for 5% of the integration cost.

---

## Timer architecture

### Source-of-truth model

Store two fields and derive the third:

```ts
timerStartedAt: number | null;     // epoch ms when ▶ pressed; null when paused
accumulatedSeconds: number;        // seconds frozen at last ⏸

// Derived (pure function, no state):
function currentMatchSeconds(now = Date.now()): number {
  if (timerStartedAt === null) return accumulatedSeconds;
  return accumulatedSeconds + Math.floor((now - timerStartedAt) / 1000);
}
```

Press ▶ → `timerStartedAt = Date.now()`.
Press ⏸ → `accumulatedSeconds = currentMatchSeconds(); timerStartedAt = null`.

This **survives backgrounding, lock screens, and refresh** for free — there's no "tick I missed" because there's no per-tick mutation.

### Per-player time, same model

Each player has:
```ts
{ id, name, isGK, accumulatedTime: number, lastOnAt: number | null }
```

`lastOnAt` is the value of `matchSeconds` when they came on. `null` while on bench.

Live time for display:
```ts
function liveTimeOnPitch(p: Player, matchSeconds: number): number {
  return p.lastOnAt === null ? p.accumulatedTime : p.accumulatedTime + (matchSeconds - p.lastOnAt);
}
```

On Confirm All (a sub coming off):
```ts
off.accumulatedTime += matchSeconds - off.lastOnAt;
off.lastOnAt = null;
on.lastOnAt = matchSeconds;
```

No per-second mutation of player records → no per-second store writes → no per-second persistence churn. The store only changes on user actions and on play/pause.

### React rendering

A single `useEffect` runs a `setInterval(1000)` that calls `forceTick()` — bumps a `tick` counter in Zustand. Components that read derived time via a selector re-render. Selectors are pure and cheap; isolate them per-component so only the clock and the cards re-render, not the whole tree.

```tsx
// Clock.tsx
const tick = useMatchStore(s => s.tick); // increments every second while running
const sec = currentMatchSeconds();
return <div>{formatTime(sec)}</div>;
```

### Half / full-time triggers

Each tick, compute `halfElapsed = matchSeconds - halfStartOffset`. When `halfElapsed >= HALF_DURATION`:
- pause the timer (`accumulatedSeconds = matchSeconds; timerStartedAt = null`)
- if `half < periods` → open Half Time overlay
- else → `matchOver = true`; render Full Time overlay; trigger Firestore write-back (with an in-progress flag to guard against double-fire)

### Sub alert

`nextAlertAt` is a target value in `matchSeconds`. The same tick effect checks `matchSeconds >= nextAlertAt && !alertFiring && !subAlertDisabled`. Fire → flash + beep + vibrate → after 4 sec, `nextAlertAt = matchSeconds + alertInterval`. Reset on `Start 2nd Half`.

---

## Substitution staging model

Cleaner type than the current `{offId, onId|null}` union:

```ts
type StagedSub =
  | { kind: 'swap'; offId: string; onId: string }
  | { kind: 'fill'; onId: string };  // bring on with no one coming off (empty-slot)

interface PendingSelection {
  pendingOn: string | null;     // bench player tapped, waiting for a pitch tap or empty slot
}
```

Actions in the store:
- `selectPlayer(id)` — handles either tap order; mutually exclusive with `matchOver`
- `removeStaged(index)`
- `cancelStaging()` — clears `pendingOn` and `stagedSubs`
- `confirmAll()` — applies all subs atomically, appends one `SubLogEntry` with the current minute

The minute formula bug (spec line 103 says `elapsed + 40`) becomes:
```ts
const minute = Math.floor(halfElapsed() / 60) + (half === 2 ? config.minutes : 0);
```

---

## Firebase usage

### Auth
- Platform-aware strategy: `signInWithPopup` for standalone PWA and desktop; `signInWithRedirect` for mobile browsers. See `appspec.md` for full details.
- `authDomain` set to `sub-manager-eb2b2.web.app` (matches hosting domain) to avoid iOS ITP cookie blocking on redirect flow.
- `useAuthState` hook → drives `App.tsx`'s screen selection.
- `getRedirectResult()` is awaited before React mounts to prevent login-screen flash after redirect.

### Firestore schema (unchanged from today)

```
teams/{teamId}
  name: string
  managerId: string (auth uid)
  logoDataUrl: string (base64, resized to 128px)
  createdAt: serverTimestamp

teams/{teamId}/players/{playerId}
  name: string
  seasonMinutes: number
  appearances: number
  createdAt: serverTimestamp

teams/{teamId}/matches/{matchId}
  date: serverTimestamp
  halfLength: number
  halves: number
  teamSize: number
  playerStats: { [playerId]: { minutesPlayed, subCount } }
```

### Writes
- Roster CRUD (add/rename/delete player, change logo, rename team) — same operations as today.
- On Full Time — one `matches/` write + one batched increment across `players/`. **Idempotency** is enforced by stamping the match document with a client-generated `matchId` (UUID created when the match starts); the write handler skips the increment if a document with the same id already exists.

### Match config validation

Custom values entered via the inline `…` fields are validated client-side before **Start Match** is enabled:

| Setting | Min | Max | Extra rule |
|---|---|---|---|
| Halves | 1 | 3 | — |
| Minutes per half | 1 | 60 | — |
| Team size | 3 | 11 | — |
| Sub alert (min) | 1 | 60 | Must be ≤ Minutes per half |

Invalid values surface an inline error and disable **Start Match**. The persisted defaults in `submanager_matchconfig` are sanitised on load so a previously-valid value that is no longer in range falls back to the closest in-range value.

### Offline / save-failure queue

Full-time write-backs that fail (offline, transient Firestore error, signed-out user, security-rule rejection) are persisted under a `submanager_pending_saves` localStorage key:

```ts
type PendingSave = {
  matchId: string;             // UUID, used for idempotency
  teamId: string;
  payload: MatchDocument;      // exact shape of the matches/{matchId} write
  playerIncrements: Record<string, { minutesPlayed: number; subCount: number }>;
  attempts: number;
  lastError?: string;
  queuedAt: number;            // epoch ms
};
```

A small flush worker (in `firebase/syncQueue.ts`) drains the queue:
- On app launch while signed in
- On `window.online` event
- On a 30-second retry timer while items are pending

Each attempt re-checks idempotency (existing `matches/{matchId}` → skip), so a successful retry is safe. A persistent banner (`Sync pending — N match(es)`) is rendered from the queue length so the coach knows data isn't lost.

### Security rules

The current app appears to operate with permissive rules. The rebuild should harden:

```js
match /teams/{teamId} {
  allow read, write: if request.auth != null && resource.data.managerId == request.auth.uid;
  allow create: if request.auth != null && request.resource.data.managerId == request.auth.uid;

  match /{document=**} {
    allow read, write: if request.auth != null
      && get(/databases/$(database)/documents/teams/$(teamId)).data.managerId == request.auth.uid;
  }
}
```

---

## Drag-and-drop (squad setup)

The current vanilla implementation hand-rolls touch-drag with a ghost div. For React, use **`@dnd-kit/core`**:
- Native touch + mouse support out of the box
- Accessible (keyboard nav for desktop)
- Small bundle vs `react-dnd`
- A `DragOverlay` component replaces the manual `dragGhostEl`

The four drop zones become `useDroppable`; the cards become `useDraggable`. The GK slot is just another droppable with a one-item capacity rule applied in the drop handler.

---

## Long-press

The 600ms long-press pattern (squad-card removal, mid-match GK swap) recurs three times in the current code. Extract a hook:

```ts
useLongPress(ref, onLongPress, { delay: 600 });
```

It cancels on touchmove/mouseleave/click and exposes a `firedRef` so the click handler can no-op when long-press already fired (preserving current behavior at `app.js:672`, `app.js:1416`).

---

## Migration plan

1. **Scaffold** — Vite + TS + Firebase config. Get login + team select working against the existing Firestore project (no schema changes).
2. **Setup flow** — Match Setup + Squad Setup screens with `@dnd-kit`. Ship localStorage persistence for match config defaults.
3. **Match screen, no timer** — Player cards, sub staging, sub log. Use the new `StagedSub` discriminated union.
4. **Timer + alert** — wall-clock derivation, sub-alert beep/vibrate. Wire half-time / full-time transitions.
5. **Full Time write-back** — port existing Firestore save logic; add idempotency guard.
6. **Season Stats screen** — port as-is.
7. **Hosting** — deploy to Firebase Hosting; rotate API key in `firebase-config.js` if exposure is a concern.
8. **Cut over** — change Hosting custom domain or repoint GitHub Pages CNAME.

The Firestore data model doesn't change, so the existing teams/players/matches in production are reused.

---

## Out of scope for this rebuild

- Score tracking
- Player position tracking beyond GK
- Multiple coaches per team
- Offline-first conflict resolution (single-writer model)
- Native mobile apps
- Tailwind / CSS-in-JS rewrite (port `styles.css` as-is)

---

## Spec ambiguities to resolve before implementation

These are tracked separately; see the inline summary in the rebuild PR's description. Highest-impact items: timer wall-clock derivation (§5), sub-log minute formula (spec line 103), suggested-subs max pairs (spec says 4, code uses 3), empty-slot visibility rule, fatigue colour gradient (in code, not in spec), late-add / mid-match remove player (in code, not in spec).
