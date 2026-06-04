# Sub Manager — App Specification

## Overview

Sub Manager is a mobile-first web application designed to help a soccer coach manage player substitutions during a match. The primary goal is to ensure fair playing time across the squad by making it easy to track who is on the pitch, who is on the bench, and how long each player has been playing.

The app runs entirely in the browser with no backend or login required. All state is held in memory for the duration of a single match session.

---

## Target User

- A youth or amateur soccer coach
- Operating on the sideline during a live match
- Using a smartphone (primary), with no time to navigate complex UIs

---

## Key Constraints

- **Phone-first**: All interactions must be comfortable on a 375px-wide touchscreen
- **No persistence**: Each session starts fresh; no data is saved between matches
- **No backend**: Single static HTML file, deployable to GitHub Pages
- **Offline-capable**: All assets (including logo) embedded directly in the file

---

## Match Format

- Configurable: **1 or 2 periods**, each **20/30/40/45 minutes** (defaults to 2 × 45 min)
- Unlimited substitutions
- Default squad of 17 named players; fill-in players can be added at setup time, or late players added during a match
- Players assigned to Absent are excluded from the match entirely
- Configurable team size: **5, 7, 9, or 11** (default 11) — supports futsal, mini-soccer, 9-a-side and full 11-a-side. Fewer than the chosen team size is permitted; the Starting column is capped at the configured size.
- One player can be designated as **Goalkeeper** (GK) via a dedicated slot in setup; the GK can be reassigned mid-match via long-press

---

## App Flow

```
Match Setup → Squad Setup → Match (1st Half) → Half Time → Match (2nd Half) → Full Time Summary
     ↑           ↑                                                                       |
     │           └── Edit link returns to Match Setup ──┐                                │
     └──────────────────────────── Reset (at any point) ┴────────────────────────────────┘
```

---

## Screen Summary

| Screen | Purpose |
|---|---|
| Match Setup | First screen — choose halves, mins/half, team size, and sub alert frequency |
| Squad Setup | Drag/tap players into Starting, Bench, or Squad pool. Shows match summary with Edit link back to Match Setup |
| Match Screen | Live view of pitch/bench/subs with timer and substitution controls |
| Half Time Overlay | Pause between halves; prompt to start 2nd half |
| Full Time Overlay | End-of-match summary with minutes played per player |
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

## Out of Scope

- Saving match history or rosters across sessions
- Player position tracking beyond GK designation (e.g. defender, forward)
- Score tracking
- Suggested substitutions based on playing time
- Multiple teams or users
- Push notifications or reminders
