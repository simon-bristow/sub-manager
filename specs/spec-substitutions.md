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

**Tap order is symmetric.** The coach can tap a pitch player first then a bench player, **or** tap a bench player first then a pitch player. The two steps below describe the most common order; either step may come first.

### Step 1 — Select a player coming off
- Tap any player in the **Pitch** column
- Their card highlights with a **red border**
- The substitution bar appears at the top of the player lists with a hint: *"↓ [Name] coming off — now tap a bench player"*

### Step 2 — Select a player coming on
- Tap any player in the **Bench** column → highlights green
- The substitution bar shows the pending hint: *"↑ [Name] coming on — tap a pitch player to swap..."*
- **Empty pitch slots are always visible** in the Pitch column whenever pitch headcount is less than the configured team size: each open slot appears as a dashed grey **Empty** placeholder at the bottom of the column. They become tap-targets only while a bench player is the pending selection. Tapping one stages the bench player as a solo addition with no one coming off; the placeholder turns green and reads **↑ Staged**
- **Team-size guard**: the number of fill subs that can be staged is capped so that `current on-pitch count + staged fills ≤ team size`. Once all empty slots are accounted for by staged fills, further empty-slot taps are ignored. This prevents the coach from accidentally exceeding the configured team size. The same guard is enforced at confirmation time as a safety net.
- Tap a regular pitch player → pair is **staged** as a normal swap

When staged:
- Normal swap appears as: `↑ [On] / ↓ [Off]`
- Solo bring-on appears as: `↑ [On] → empty slot`

The Pitch column header shows the current fill against team size, e.g. **Pitch (10/11)**.

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
- **Tap a staged card**: tapping either player card that is part of a staged pair removes that pair from the queue (equivalent to the row's individual ✕). This makes un-staging reachable directly from the player columns.

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
- **Coming off**: on-pitch players, **GK excluded**, sorted by most time played
- **Coming on**: bench players, **GK excluded**, sorted by least time played
- The GK exclusion applies to both candidate lists — the recommender never suggests swapping the goalkeeper in either direction. Goalkeeper changes go through the **Change GK** long-press flow instead.
- Pairs are matched 1-to-1: most-played off ↔ least-played on
- Maximum of **4 pairs** shown (limited by bench availability)

### Panel behaviour
- Slides up from the bottom of the screen
- Each row shows: a checkbox circle · ↓ player off (red, time played) ⇄ ↑ player on (green, time played)
- Rows start **unselected** — tap a row to select it (amber tick + border); tap again to deselect
- Already-staged pairs are faded and non-tappable (shown with a green tick)
- **Stage Selected (N)** button is disabled until at least one row is selected; shows the count of selected rows
- Tapping **Stage Selected** adds only the selected pairs to the substitution staging bar, clears the selection, and closes the panel
- **Close** dismisses the panel without staging anything; selection is discarded

## Constraints

- **A swap requires one pitch player and one bench player.** A pair is only staged once one of each is selected — the order doesn't matter. Selecting a second player on the *same* side (two pitch, or two bench) simply moves the highlighted pending selection to the newly-tapped player rather than staging anything. This guarantees every swap is a valid pitch↔bench match.
- Tapping the currently-pending player again clears the selection (deselect)
- The pending selection is shown by a coloured card border — **red** for a pitch player waiting to come off, **green** for a bench player waiting to come on — plus a hint line in the substitution bar
- A player already staged as "coming off" cannot be selected again
- A player already staged as "coming on" cannot be selected again
- Tapping an already-staged pitch player has no effect (must use individual ✕ to remove)
- Players in the Absent group are never shown and cannot be substituted on

---

## Substitution Log

After **Confirm All** is tapped, one grouped log event is created containing all pairs from that action:

- **Order number** — a small `#N` label (e.g. `#1`, `#2`) shown before the minute stamp, indicating whether this was the 1st, 2nd, 3rd… substitution event of the match. This persists regardless of the display sort order (Latest/Earliest), so the coach can always tell which sub came first
- **Minute** — match minute stamp shown immediately after the order number. 1st half = elapsed minutes in the current half; 2nd half = elapsed minutes in the current half + the configured **minutes per half** value (so for a 30-minute half, a sub at 5:00 of the 2nd half logs as minute 35)
- **Grouped by direction, side by side** — rather than pairing on/off line by line, the event shows two columns: all players **coming on** (↑ green) in the left column and all players **coming off** (↓ red) in the right column, separated by a thin vertical divider. The two-column layout keeps a busy log compact (each event is roughly half the height of a stacked list) and makes multi-substitution combinations easy to scan ("these came on, these went off")
- Names are truncated with an ellipsis to fit the narrow column; the full names are always visible in the long-press popup (below)
- Solo bring-ons (empty-slot fills) simply appear in the ↑ column with no corresponding ↓ entry; if an event has no players coming off, only the left column is shown (full width)
- Log events default to **most-recent first** (newest at top)
- **Order toggle** — when more than one log event exists, a sort toggle in the Subs column header (a standard sort icon plus label, matching the Pitch/Bench column toggles) switches between **Latest** (newest first) and **Earliest** (oldest first). This lets the coach scroll back to the very first substitutions of the match when many have been made. Default is Latest.
- The column header count reflects total individual player swaps (not events)

### Undoing a Substitution

A substitution confirmed in error (e.g. **Confirm All** tapped too early) can be reversed directly from the sub log:

- **Long-press** (600ms hold) on a sub log entry opens a confirmation popup summarising that event (the players who came on ↑ and went off ↓, and the minute)
- The popup offers three choices:
  - **Delete substitution** — removes the log entry and **restores every affected player to their exact pre-confirm state** (on/off-pitch status, time-on-pitch tracking, and sub count). The players return to the previous state as though the substitution never happened
  - **Send back to staging** — restores the affected players to their pre-confirm state *and* re-stages the same pair(s) in the substitution bar, so the coach can adjust and re-confirm
  - **Cancel** — closes the popup with no change
- The reversal is driven by a snapshot of the affected players captured at confirm time, so it is exact. It is intended for correcting a recent mistake; undoing an older event after further subs have moved the same players is not guaranteed to be consistent
- A normal tap (or scroll) on a log entry does nothing — only a deliberate long-press opens the popup
