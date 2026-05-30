# Spec: Full Time Summary

## Purpose

At the end of the match, show the coach a clear breakdown of how much time each player spent on the pitch — the primary fairness metric the app is designed to support.

---

## Trigger

The Full Time Summary overlay appears automatically when:

- The timer reaches **40:00** in the 2nd half, **or**
- The coach manually taps the **F/T** button during the 2nd half

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
│         [ New Match ]               │
└─────────────────────────────────────┘
```

---

## Table Columns

| Column | Description |
|---|---|
| Player | Player name |
| Mins | Cumulative time on pitch in `MM:SS` format |
| Bar | Proportional green bar; longest-played player = 100% width |

---

## Sorting

- Players are sorted by **time on pitch descending** (most played at top)
- All players included in the match (Starting + Bench) appear in the table
- Absent players are excluded

---

## Bar Chart

- Each row includes a small horizontal bar showing time played relative to the most-played player
- The player with the most time always has a full-width bar (100%)
- All other bars are proportional
- Purpose: allows the coach to quickly spot imbalances in playing time at a glance

---

## Scrolling

- The overlay card scrolls vertically if the squad is large enough that all rows don't fit on screen
- The "New Match" button remains accessible by scrolling to the bottom

---

## New Match

- Tapping **New Match** reloads the app, returning to the Squad Setup screen
- All match data is discarded

---

## "FULL TIME" Banner

- When full time is triggered, a persistent amber banner reading **FULL TIME** appears at the top of the match screen (behind the overlay)
- The ▶ button is disabled; the timer cannot be restarted
