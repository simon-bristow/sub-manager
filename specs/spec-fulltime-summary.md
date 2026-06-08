# Spec: Full Time Summary

## Purpose

At the end of the match, show the coach a clear breakdown of how much time each player spent on the pitch — the primary fairness metric the app is designed to support.

---

## Trigger

The Full Time Summary overlay appears automatically when:

- The timer reaches the configured half duration in the final period, **or**
- The coach manually taps the **F/T** button during the final period

---

## Overlay Content

```
┌─────────────────────────────────────┐
│           Full Time                 │
│    Minutes played per player        │
│                                     │
│  PLAYER          MINS               │
│  Conrad          40:00  ══════════  │
│  Sam             40:00  ══════════  │
│  Noah            35:12  ════════░░  │
│  Arlo            28:45  ██████░░░░  │
│  ...                                │
│  Sol              0:00  ░░░░░░░░░░  │
│                                     │
│    [ Season Stats → ]  [ New Match ]│
└─────────────────────────────────────┘
```

---

## Table Columns

| Column | Description |
|---|---|
| Player | Player name, preceded by an amber **GK** badge if designated goalkeeper |
| Mins | Cumulative time on pitch in `MM:SS` format |
| Bar | Proportional green bar; longest-played player = 100% width |

---

## Sorting

- Players are sorted by **time on pitch descending** (most played at top)
- All players included in the match (Starting + Bench) appear in the table
- Squad (pool) players are excluded

---

## Bar Chart

- Each row includes a small horizontal bar showing time played relative to the most-played player
- The player with the most time always has a full-width bar (100%)
- All other bars are proportional
- Purpose: allows the coach to quickly spot imbalances in playing time at a glance

---

## Scrolling

- The overlay card scrolls vertically if the squad is large enough that all rows don't fit on screen
- The action buttons remain accessible by scrolling to the bottom

---

## Actions

- **Season Stats →** — navigates to the Season Stats screen to view cumulative data; match stats are written to Firestore before navigating
- **New Match** — reloads the app, returning to the Match Setup screen; all match data is discarded

---

## Season Stat Write-Back

When full time is reached, each player who participated (Starting + Bench, excluding any players removed mid-match) has their `timeOnPitch` converted to whole minutes via **`Math.floor(timeOnPitch / 60)`** and incremented onto their Firestore `seasonMinutes`, alongside an `appearances` increment of 1. So a stint of 59 seconds counts as 0 added minutes; the rounding is intentional and matches the `MM:SS` display semantics.

The write-back is gated by an **idempotency flag** stored on the match: even if both the final timer tick and a manual F/T tap fire in the same second, the season totals are only incremented once. The same flag prevents a re-trigger if the coach navigates away and back to the Full Time overlay.

### Save failure handling

The full-time write performs a `matches/{matchId}` insert plus a batched `seasonMinutes` / `appearances` increment. If either fails (offline, network error, transient Firestore error):

- The full pending write payload is queued in `localStorage` under `submanager_pending_saves`
- A small **"Sync pending…"** banner appears on the Full Time overlay and on subsequent screens until the queue drains
- The app retries automatically when the network reports `online`, and on every subsequent app launch while signed in
- The coach can still tap **New Match** or **Season Stats →** — the queued write will be flushed in the background; the new-match flow does not clear the pending queue
- No data is lost; duplicate writes are prevented by including the original match `matchId` so a successful second attempt skips the increment

---

## "FULL TIME" Banner

- When full time is triggered, a persistent amber banner reading **FULL TIME** appears at the top of the match screen (behind the overlay)
- The ▶ button is disabled; the timer cannot be restarted
