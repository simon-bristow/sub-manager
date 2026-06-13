# Sub Manager — App Specification

## Overview

Sub Manager is a mobile-first web application designed to help a soccer coach manage player substitutions during a match. The primary goal is to ensure fair playing time across the squad by making it easy to track who is on the pitch, who is on the bench, and how long each player has been playing.

The app uses a Firebase backend for authentication and season statistics. Live match state is held in a local store that is persisted to `localStorage` on every change, so a phone lock, accidental refresh, or browser crash mid-match recovers seamlessly. Persisted match state is cleared on **Reset**, **New Match**, or successful **Full Time** write-back.

---

## Target User

- A youth or amateur soccer coach
- Operating on the sideline during a live match
- Using a smartphone (primary), with no time to navigate complex UIs

---

## Key Constraints

- **Phone-first**: All interactions must be comfortable on a 375px-wide touchscreen
- **Refresh-safe match state**: Live match state is persisted to `localStorage` via Zustand's `persist` middleware, so a phone lock, accidental refresh, or browser crash recovers seamlessly
- **Firebase backend**: Google authentication + Firestore for team roster and season stats
- **React + Vite**: React 18, TypeScript, Zustand for state, `@dnd-kit` for drag-and-drop, hosted on Firebase Hosting as a PWA

---

## Match Format

- Configurable: **1 or 2 periods**, each **20/30/40/45 minutes** (defaults to 2 × 45 min)
- Unlimited substitutions
- Team roster stored in Firestore; fill-in players can be added at setup time
- Players assigned to Squad are excluded from the match entirely
- Configurable team size: **5, 7, 9, or 11** (default 11)
- One player can be designated as **Goalkeeper** (GK) via a dedicated slot in setup; the GK can be reassigned mid-match via long-press

---

## App Flow

```
Login → Team Select → Match Setup → Squad Setup → Match (1st Half) → Half Time → Match (2nd Half) → Full Time Summary
                                                                                                            |
                                                                                                     Season Stats
                                                                         ↑
                                                                    Reset (at any point)
```

---

## Screen Summary

| Screen | Purpose |
|---|---|
| Login | Google sign-in |
| Team Select | Choose or create a team; links to Season Stats |
| Match Setup | Choose halves, mins/half, team size, and sub alert frequency. Header shows team name with a "Change" link to return to Team Select. |
| Squad Setup | Drag/tap players into Starting, Bench, or Squad pool |
| Match Screen | Live view of pitch/bench/subs with timer and substitution controls |
| Half Time Overlay | Pause between halves; prompt to start 2nd half or resume 1st half |
| Full Time Overlay | End-of-match summary with minutes played per player |
| Season Stats | Firebase-backed cumulative season minutes and appearances per player |
| Reset Confirmation | Confirm before discarding the current match |

---

## Sub-Specifications

| Feature | Spec File |
|---|---|
| Squad Setup | [spec-squad-setup.md](spec-squad-setup.md) |
| Match Timer | [spec-match-timer.md](spec-match-timer.md) |
| Player Tracking | [spec-player-tracking.md](spec-player-tracking.md) |
| Substitutions | [spec-substitutions.md](spec-substitutions.md) |
| Full Time Summary | [spec-fulltime-summary.md](spec-fulltime-summary.md) |

---

## Season Stats Screen

Accessible from the Full Time overlay ("Season Stats →") or from the Team Select screen.

- Shows cumulative season data for every player in the team's Firestore roster
- Columns: Player, Mins (season total), Apps (appearances), Avg (minutes per appearance)
- Sorted by season minutes descending
- **Reset all stats…** button clears all season minutes and appearances to zero (with confirmation overlay)
- **New Match** button starts a fresh match setup from this screen
- **← Back** returns to the previous screen
- When Full Time is confirmed, each on-pitch/bench player's `timeOnPitch` (converted to minutes) and an appearance count of 1 are written to Firestore

---

## Authentication

- Google sign-in via Firebase Auth with a platform-aware strategy:
  - **Standalone PWA** (home-screen app on iOS/Android): uses `signInWithPopup` — redirect flow cannot return to a standalone web app
  - **Mobile browser** (iOS Chrome/Safari, Android): uses `signInWithRedirect` — popups open as new tabs with broken cross-tab communication
  - **Desktop**: uses `signInWithPopup` with `signInWithRedirect` as fallback if the popup is blocked
- `authDomain` is set to the hosting domain (`sub-manager-eb2b2.web.app`) rather than the default `firebaseapp.com` — required for redirect flow on iOS where WebKit's ITP blocks cross-origin auth cookies
- The service worker excludes `/__/*` paths (`navigateFallbackDenylist`) so Firebase's `/__/auth/handler` callback page is served from the network, not the cached SPA shell
- The app waits for `getRedirectResult()` to resolve before mounting React, preventing a flash of the login screen after a redirect auth flow
- On successful sign-in the user is taken to the Team Select screen
- Sign-out is accessible from the Team Select screen
- Auth state is observed via `useAuthState`; unauthenticated users always see the Login screen

## Version Badge

- A small, semi-transparent version label (e.g. `v0.53`) is fixed to the **bottom-right** of every screen, respecting safe-area insets
- The version string is defined once in `src/version.ts` (`APP_VERSION`) and reused by both the badge and the About overlay
- Pre-release candidate — versions stay below v1.0 and bump by 0.01 per meaningful change

## Favicon

- `favicon.png` (32×32 PNG) — tab bar icon; green ↑ and red ↓ substitution arrows on dark navy background
- `apple-touch-icon.png` (180×180 PNG) — iOS home screen icon, referenced via `<link rel="apple-touch-icon">`

---

## Out of Scope

- Score tracking
- Player position tracking beyond GK designation
- Multiple users per team (single-account model)
