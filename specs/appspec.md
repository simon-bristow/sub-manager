# Sub Manager — App Specification

## Overview

Sub Manager is a mobile-first web application designed to help a soccer coach manage player substitutions during a match. The primary goal is to ensure fair playing time across the squad by making it easy to track who is on the pitch, who is on the bench, and how long each player has been playing.

The app uses a Firebase backend for authentication and season statistics. All match state is held in memory for the duration of a single match session.

---

## Target User

- A youth or amateur soccer coach
- Operating on the sideline during a live match
- Using a smartphone (primary), with no time to navigate complex UIs

---

## Key Constraints

- **Phone-first**: All interactions must be comfortable on a 375px-wide touchscreen
- **No in-match persistence**: Each match session starts fresh; match data is not saved between matches
- **Firebase backend**: Google authentication + Firestore for team roster and season stats
- **Multi-file**: index.html + styles.css + app.js + firebase-config.js

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
| Match Setup | Choose halves, mins/half, team size, and sub alert frequency |
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

- Google sign-in via Firebase Auth
- On successful sign-in the user is taken to the Team Select screen
- Sign-out is accessible from the About overlay (logo tap)
- Auth state is observed; unauthenticated users always see the Login screen

---

## Out of Scope

- Score tracking
- Player position tracking beyond GK designation
- Suggested substitutions based on playing time
- Multiple users per team (single-account model)
