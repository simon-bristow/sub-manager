# Spec: Substitutions

## Purpose

Allow the coach to plan and execute one or more simultaneous substitutions with a minimal number of taps, while maintaining a clear log of all changes made during the match.

---

## Core Concepts

- A **substitution** is a swap between one on-pitch player (coming off) and one bench player (coming on)
- Multiple substitutions can be **staged** (queued) before being confirmed together — reflecting real-world scenarios where 2 or 3 players are swapped at once
- A sub is only committed when the coach taps **Confirm All**

---

## Interaction Flow

### Step 1 — Select a player coming off
- Tap any player in the **Pitch** column
- Their card highlights with a **red border**
- The substitution bar appears at the top of the player lists with a hint: *"↓ [Name] coming off — now tap a bench player"*

### Step 2 — Select a player coming on
- Tap any player in the **Bench** column
- The pair is immediately **staged**: both cards lock in (red for off, green for on)
- The staged pair appears in the substitution bar as a row: `↑ [On] / ↓ [Off]`
- The pending hint clears

### Step 3 — Add more pairs (optional)
- Repeat steps 1–2 to stage additional substitution pairs
- There is no limit on the number of pairs that can be staged at once
- Each additional pair appears as a new row in the substitution bar

### Step 4 — Confirm or Cancel
- **Confirm All**: executes all staged swaps simultaneously
  - All "coming off" players move to the Bench column
  - All "coming on" players move to the Pitch column
  - Each swap is logged with the current match minute
  - The substitution bar dismisses
- **✕ (cancel all)**: clears all staged pairs and the pending selection; no changes are made
- **Individual ✕**: removes a single staged pair from the queue without affecting others

---

## Substitution Bar

Shown at the top of the player list area whenever there is any pending activity:

```
SUBSTITUTIONS                        [✕]  [Confirm All]
┌─────────────────────────────────────────────────┐
│  ↑ Sub A  /  ↓ Player 2                     [✕] │
│  ↑ Sub B  /  ↓ Goalkeeper                   [✕] │
└─────────────────────────────────────────────────┘
↓ Player 3 coming off — now tap a bench player
```

- **Confirm All** is disabled (greyed out) until at least one complete pair is staged
- The pending hint line shows only when a "coming off" player has been tapped but no bench player has been selected yet

---

## Suggested Substitutions (★ button)

The **★** button in the match header opens a "Suggested Subs" panel that recommends up to 4 substitution pairs based on playing time fairness.

### Logic
- **Coming off**: on-pitch players (excluding GK), sorted by most time played
- **Coming on**: bench players (excluding GK), sorted by least time played
- Pairs are matched 1-to-1: most-played off ↔ least-played on
- Maximum of 4 pairs shown (limited by bench availability)

### Panel behaviour
- Slides up from the bottom of the screen
- Each row shows: a checkbox circle · ↓ player off (red, time played) ⇄ ↑ player on (green, time played)
- Rows start **unselected** — tap a row to select it (amber tick + border); tap again to deselect
- Already-staged pairs are faded and non-tappable (shown with a green tick)
- **Stage Selected (N)** button is disabled until at least one row is selected; shows the count of selected rows
- Tapping **Stage Selected** adds only the selected pairs to the substitution staging bar, clears the selection, and closes the panel
- **Close** dismisses the panel without staging anything; selection is discarded

## Constraints

- A player already staged as "coming off" cannot be selected again
- A player already staged as "coming on" cannot be selected again
- Tapping an already-staged pitch player has no effect (must use individual ✕ to remove)
- Players in the Absent group are never shown and cannot be substituted on

---

## Substitution Log

After **Confirm All** is tapped, one grouped log event is created containing all pairs from that action:

- **Minute** — match minute stamp at the top of the event card (1st half = elapsed minutes; 2nd half = elapsed + 40)
- **Pairs** — one row per swap: ↑ player coming on (green), ↓ player coming off (red)
- Multiple pairs in the same Confirm All are grouped into a single card with divider lines between pairs
- Log events are shown most-recent first (newest at top)
- The column header count reflects total individual player swaps (not events)
