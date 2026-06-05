# Spec: Match Timer

## Purpose

Provide a live clock that tracks match time across one or two halves, giving the coach an accurate reference for when substitutions are made.

---

## Timer Behaviour

- The timer counts **up** from 00:00
- Each period runs for the duration configured at setup (20, 30, 40, or **45** min — 45 is default)
- The match can be set to **1** or **2** periods (default 2) at setup
- The clock resets to 00:00 at the start of each period (display only — internally match time is cumulative)
- The timer does **not** auto-start; the coach manually starts it

## Match Configuration

Set on the Match Setup screen before kickoff:

| Setting | Options | Default |
|---|---|---|
| Number of periods | 1, 2 | 2 |
| Minutes per period | 20, 30, 40, 45 | 45 |

When **1 period** is selected, the **H/T** button is replaced by **F/T**, the period label is "Period", and there is no half-time overlay.

---

## Controls

| Button | Icon | Action |
|---|---|---|
| Start / Pause / Resume | ▶ / ⏸ | Toggles the timer on/off |
| Half Time | H/T | Stops the clock and opens the Half Time overlay |
| Full Time | F/T | (2nd half only) Stops the clock and opens the Full Time overlay |
| Reset | ✕ | Opens the Reset confirmation dialog |

- The ▶/⏸ button is **always green** regardless of timer state
- In the 1st half, the third button reads **H/T**
- At the start of the 2nd half, it switches to **F/T**
- After full time, the ▶ button is disabled

---

## Automatic Triggers

- At the end of any non-final period: timer auto-stops and the Half Time overlay appears
- At the end of the final period: timer auto-stops and the Full Time overlay appears
- The coach can also trigger these manually at any time via the H/T or F/T buttons

---

## Half Time Overlay

- Shown between halves
- Displays: "Half Time"
- Options:
  - **Start 2nd Half** — resets the display clock to 00:00 and begins the second half
  - **Resume 1st Half** — dismisses the overlay and resumes the timer in the 1st half (e.g. if triggered accidentally)
  - **Stay at Half Time** — dismisses the overlay but keeps the timer paused at half time
- The clock label updates from "1st Half" to "2nd Half" when the 2nd half begins

---

## Display

- Main clock shows elapsed time in `MM:SS` format, large and bold, using tabular numerals
- A smaller, muted **time-left** counter (e.g. `-12:34`) appears next to the main clock, showing the remaining time in the current half
- A smaller **Next sub in MM:SS** countdown sits below the clock row, showing how long until the next substitution reminder
- "1st Half" / "2nd Half" label shown above the clock
- Timer display is capped at the configured half duration even if the clock overruns slightly

## Sub Alert

- The interval is configured at setup (Sub alert row — default 10 min)
- The countdown ticks down from the configured interval; pauses when the match timer pauses
- The sub alert counter **resets to the configured interval** when the 2nd half starts
- When the countdown is within the **final minute** (≤ 60 sec), it turns **red and bold** as a warning
- When it hits 0:
  - The countdown turns amber and pulses, reading **SUB NOW!**
  - A short beep plays (where Web Audio is supported)
  - The phone vibrates briefly (where supported)
- After 4 seconds the alert clears and the countdown resets to the configured interval, starting again from the current match time
- A **✕ (dismiss)** button on the sub alert row allows the coach to suppress sub alerts for the remainder of the match; tapping it hides the row and disables further alerts

---

## Time Tracking

- Every second the timer runs, each player currently **on pitch** accumulates +1 second to their `timeOnPitch` total
- This is the source of truth for the Full Time Summary and the live time display on each player card
