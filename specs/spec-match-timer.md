# Spec: Match Timer

## Purpose

Provide a live clock that tracks match time across two 40-minute halves, giving the coach an accurate reference for when substitutions are made.

---

## Timer Behaviour

- The timer counts **up** from 00:00
- Each half runs for **40 minutes** (2,400 seconds)
- The clock resets to 00:00 at the start of each half (display only — internally match time is cumulative)
- The timer does **not** auto-start; the coach manually starts it

---

## Controls

| Button | Icon | Action |
|---|---|---|
| Start / Pause / Resume | ▶ / ⏸ | Toggles the timer on/off |
| Half Time | H/T | Stops the clock and opens the Half Time overlay |
| Full Time | F/T | (2nd half only) Stops the clock and opens the Full Time overlay |
| Reset | ✕ | Opens the Reset confirmation dialog |

- In the 1st half, the third button reads **H/T**
- At the start of the 2nd half, it switches to **F/T**
- After full time, the ▶ button is disabled

---

## Automatic Triggers

- At **40:00** in the 1st half: timer auto-stops and the Half Time overlay appears
- At **40:00** in the 2nd half: timer auto-stops and the Full Time overlay appears
- The coach can also trigger these manually at any time via the H/T or F/T buttons

---

## Half Time Overlay

- Shown between halves
- Displays: "Half Time"
- Options:
  - **Start 2nd Half** — resets the display clock to 00:00 and resumes timing
  - **Stay at Half Time** — dismisses the overlay but keeps the timer paused
- The clock label updates from "1st Half" to "2nd Half" when the 2nd half begins

---

## Display

- Clock is shown in `MM:SS` format using tabular (fixed-width) numerals
- "1st Half" / "2nd Half" label shown above the clock
- Timer display is capped at 40:00 even if the clock overruns slightly

---

## Time Tracking

- Every second the timer runs, each player currently **on pitch** accumulates +1 second to their `timeOnPitch` total
- This is the source of truth for the Full Time Summary and the live time display on each player card
