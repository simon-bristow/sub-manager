# Spec: Squad Setup

## Purpose

Allow the coach to assign players to one of three roles before a match starts: **Starting**, **Bench**, or **Squad** (pool). This is the **second screen** in the setup flow — the first is Match Setup (halves, duration, team size, sub alert).

## Squad / Roster

The team's roster is loaded from Firestore for the authenticated team. Additional fill-in players can be added during setup.

All players begin in the **Squad** column on load. The coach drags each player to their correct column for the day.

---

## Layout

Three columns fill the screen between the header and the bottom controls (left to right):

| Column | Colour | Notes |
|---|---|---|
| Squad | Muted grey | Pool of players not assigned to Starting/Bench; shows count. Bin zone at bottom. |
| Bench | Blue tint | Shows player count |
| Starting | Green tint | Contains GK slot + outfield player cards + empty slot placeholders; shows player count |

The columns are capped at `max-height: 50vh` so the Start Match button is always visible on screen. Columns scroll internally when there are many players.

Players within each column are displayed **sorted alphabetically** by name.

### GK Slot

- A dedicated amber-bordered **GK** drop zone sits at the top of the Starting column
- The coach drags one player into it to designate them as goalkeeper
- The GK player appears in the GK slot instead of the regular Starting list (no duplicate)
- When empty, the GK slot shows only the "GK" badge (no placeholder text)
- Dragging the GK player out of the slot clears the GK designation
- The GK slot is optional — the match can start without a GK assigned
- Only one player can occupy the GK slot at a time; dropping a new player replaces the previous one

### Empty Slot Placeholders

- Unfilled outfield positions in the Starting column are shown as dashed-border empty boxes (same style as the match screen empty slots)
- The number of empty placeholders = team size − 1 (GK slot) − outfield players assigned
- This gives the coach a visual indication of how many starting spots remain

---

## Drag and Drop

- Players are represented as compact cards showing the player's name
- Cards can be dragged between any of the three columns
- Both **touch drag** (mobile) and **mouse drag** (desktop) are supported
- The destination column highlights when a card is hovered over it
- The source card dims while being dragged
- A floating ghost clone follows the finger/cursor during the drag
- Dropping outside a valid zone cancels the drag with no change

## Tap to Move

A single tap on a roster card moves it according to the rules below — a faster alternative to drag for one-handed sideline use:

| Current column | Tap destination |
|---|---|
| Squad | Pitch if pitch < team size, otherwise Bench |
| Bench | Pitch if pitch < team size, otherwise no change |
| Pitch | Squad (clears GK designation if the tapped card is the current GK) |

---

## Drag-to-Bin Removal

A **bin zone** sits at the bottom of the Squad column, styled with a red dashed border and a 🗑 icon. When a player card is dragged over it, the zone highlights with a red tint.

- Dropping any player card onto the bin zone opens a confirmation overlay: *"Remove player? Their season stats will also be deleted."*
- Confirming **hard-deletes** the player: the Firestore player document (including `seasonMinutes` and `appearances`) is removed, and the player disappears from the local roster. The deletion is not reversible from within the app.
- Cancelling closes the overlay with no change
- Players from any column (Squad, Bench, or Starting) can be dragged to the bin

---

## Validation

- At least 1 player must be in the Starting column to enable **Start Match**
- The Starting column is **hard-capped at the configured team size** — further drags or taps into the Starting column are ignored once it is full
- No validation is applied to the Bench or Squad columns

### Match config bounds

Custom values typed into the inline `…` fields must fall within the following ranges. Out-of-range entries are rejected; **Start Match** stays disabled until all four values are valid.

| Setting | Min | Max | Extra rule |
|---|---|---|---|
| Halves | 1 | 3 | — |
| Minutes per half | 1 | 60 | — |
| Team size | 3 | 11 | — |
| Sub alert (minutes) | 1 | 60 | Must be ≤ Minutes per half |

---

## Starting the Match

- Tapping **Start Match** transitions directly to the Match Screen
- Players in the Starting column become **on pitch**
- Players in the Bench column become **on bench**
- Players in the Squad column are excluded entirely from the match

---

## Match Configuration

Above the column zones, button-group selectors (on the Match Setup screen) capture match format:

- **Halves**: `1` or `2` (default 2)
- **Mins/half**: `20`, `30`, `40`, `45`, or a custom value typed into the inline `…` text field (default 45)
- **Team size**: `5`, `7`, `9`, `11`, or a custom value typed into the inline `…` text field (default 11)
- **Sub alert**: `5`, `10`, `15`, `20`, or a custom value (minutes between automatic substitution reminders, default 10)

Match config values are **persisted to localStorage** so the last-used settings are pre-filled on next session.

The Starting column header updates immediately (e.g. "Starting 5" for futsal) and caps drops at the chosen size.

Selected option highlights in green. Values are applied when **Start Match** is tapped.

## Adding Players

- A text input (placeholder: "Add player") and **+** button sit below the three columns
- Typing a name and tapping **+** (or pressing Enter) adds the player to the Squad column and saves them to Firestore
- Added players can then be dragged into Starting or Bench like any regular player
- Duplicate names (case-insensitive) are rejected with an error message

## Header

- Displays the team logo (top-left)
- Displays "Squad" title and the team name
- No edit button in the header — editing is accessible via the match summary banner below

## Match Summary Banner

A compact summary banner sits beneath the header showing the chosen match format, e.g. *"2 × 45 min · 11-a-side · Sub alert 10 min"*. A green **Edit** link next to it returns to the Match Setup screen if changes are needed.
