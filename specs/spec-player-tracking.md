# Spec: Player Tracking

## Purpose

Give the coach a live, at-a-glance view of every player's current status and cumulative time on pitch during the match.

---

## Match Screen Layout

The match screen is divided into three columns (left to right) that fill the full screen height:

| Column | Content |
|---|---|
| **Bench** | Players available for substitution |
| **Pitch** | Players currently on the field |
| **Subs** | Log of completed substitutions |

All three columns are visible simultaneously without scrolling — the entire squad fits on one screen.

---

## Player Cards

Each player (on pitch or bench) is shown as a compact single-line card:

```
[ GK  Player Name          MM:SS ]
```

- **GK badge** — amber pill shown only for the designated goalkeeper
- **Name** — left-aligned, truncated with ellipsis if too long
- **Bench count** — a small, subtle number shown immediately after the name: how many times the player has been on the bench. Players who **start on the bench** begin at **1**; each time a player is **subbed off** it increments by 1. Starters who have never been benched show **0** as no number (it is hidden to keep the pitch uncluttered). Helps the coach see rotation fairness at a glance. The count uses the card's contrasting text colour so it stays readable on the fatigue background.
- **Time** — right-aligned, shows cumulative time on pitch in `MM:SS`
- **Whole-card fatigue colour** — the entire card background is tinted by a **fatigue gradient** relative to the most-played player on the squad, so each player's load reads at a glance during the game (not just from the clock):
  - 0–50% of max → cool blue → green
  - 50–100% of max → green → amber → red
  - The card's text colour automatically switches between dark and light based on the background's luminance, so the name and clock stay legible across the whole gradient
  - Bench players use the same gradient (their time is frozen but their position on the scale is preserved)
  - When a card is selected/staged for a substitution, the red/green selection highlight takes over from the fatigue tint so the pending sub is unmistakable
- Cards are sorted by **time on pitch descending** — most-played player always appears at the top (subject to the column sort toggle)

---

## Sorting

Both the **Pitch** and **Bench** columns have their own sort toggle in the column header — a standard sort icon plus a short label showing the active mode. Tapping it cycles through five modes:

| Mode | Label | Order |
|---|---|---|
| Max time | **Time↓** | Most time on pitch first (default) — spot who is due for a rest |
| Min time | **Time↑** | Least time on pitch first — spot who needs minutes |
| Alphabetical | **A–Z** | By player name — quickly find a specific player |
| Max bench | **Bench↓** | Most times benched first — spot who's been rotated most |
| Min bench | **Bench↑** | Fewest times benched first — spot who's never been rested |

- The two bench modes order by each player's **bench count** (see Player Cards); ties fall back to time on pitch
- The toggle appears only when the column holds more than one player
- Each column remembers its own mode independently; both default to **Time↓**
- The list re-sorts live (every tick) so the order stays accurate as time accumulates and after every substitution
- The Subs column uses the same-looking toggle to flip log order between **Latest** and **Earliest** (see [spec-substitutions.md](spec-substitutions.md))

---

## Selection State (for substitutions)

Player cards change appearance when selected as part of a pending substitution:

| State | Border | Background |
|---|---|---|
| Default (pitch) | Subtle dark border | Standard surface |
| Default (bench) | None | Standard surface |
| Selected — coming off | Red border | Red tint |
| Selected — coming on | Green border | Green tint |
| Already staged | Same as selected | Dims tap target |

See [spec-substitutions.md](spec-substitutions.md) for full substitution interaction detail.

---

## Substitution Log Column

- The **Subs** column shows a compact history of all substitutions made in the match
- Each **log event** represents one **Confirm All** action, which may contain one or more pairs
- Each event shows:
  - Match minute (amber) at the top of the card
  - Two side-by-side columns: players coming on (↑ green) on the left, players coming off (↓ red) on the right, separated by a thin vertical divider — keeping a busy log compact and easy to scan. Long names truncate to fit; full names appear in the long-press popup
- Events are shown most-recent first (newest at top) by default; a header sort toggle (**Latest** / **Earliest**, same style as the Pitch/Bench toggles) flips the order so the coach can review the earliest subs first when many have been made
- The column header shows a count of total individual player swaps made
- The column scrolls independently if there are many entries
- **Long-press** a log entry to open the undo popup — delete the substitution (restoring players to their pre-confirm state) or send it back to staging. See [spec-substitutions.md](spec-substitutions.md) for full detail

---

## Changing the Goalkeeper Mid-Match

- **Long-press** (600ms hold) on any player card opens a "Change Goalkeeper?" confirmation popup
- The popup shows: *"Change GK from [current GK] to [long-pressed player]?"*
- If no GK is currently set: *"Assign [player] as goalkeeper?"*
- Long-pressing the current GK does nothing (they are already GK)
- Tapping **Yes, change GK** transfers the GK badge to the new player and updates all cards
- Tapping **Cancel** closes the popup with no change
- A regular tap on the card still performs normal substitution selection

## GK Badge Persistence

- The GK designation is **per match**, not per on-pitch state
- If the current GK is substituted off, they keep the GK badge while on the bench
- The badge only moves via the **Change Goalkeeper** long-press flow
- This means a backup GK coming on does **not** automatically receive the badge — the coach must long-press to transfer it explicitly

## Adding a Player Mid-Match

- A small **+ Add Player** button in the match header opens a confirmation overlay with a name input
- Submitting adds the player as a new Firestore roster entry and inserts them into the live match on the **bench** with `timeOnPitch = 0`
- They become a normal bench player — eligible for substitution on, included in the Full Time summary, and counted in season stats on full-time write-back
- Duplicate names (case-insensitive) are rejected with an inline error

## Removing a Player Mid-Match

- The player options long-press sheet (the same overlay used to change GK) includes a **Remove from match** option
- Confirming removes the player from the live match entirely: they vanish from the pitch/bench columns, are unstaged from any pending substitution, and are **excluded from the Full Time summary and the season write-back**
- The player's Firestore roster document is **not** deleted — only their participation in this match is cancelled
- This is intended for late no-shows or injuries discovered after kickoff

## Header

The match screen header (sticky, always visible) shows:

- Team logo (top-left)
- Half label ("1st Half" / "2nd Half")
- Live match clock (`MM:SS`)
- Control buttons: ▶/⏸ (always green), H/T (or F/T), ✕
