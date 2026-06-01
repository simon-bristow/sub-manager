# Spec: Squad Setup

## Purpose

Allow the coach to assign players to one of three roles before a match starts: **Starting 11**, **Bench**, or **Absent**. The setup screen is the entry point of the app and must be completed before a match can begin.

---

## Default Squad

A fixed roster of 17 named players is pre-loaded each session:

> Conrad, Sam, Noah, Arlo, Eoin, Cooper, Hobie, Tom, Harry, Oak, Cohen, Akira, Hamish, Amina, Otis, Tate, Sol

All players begin in the **Absent** column on load. The coach drags each player to their correct column for the day.

---

## Layout

Three columns fill the screen between the header and the bottom controls:

| Column | Colour | Notes |
|---|---|---|
| Starting 11 | Green tint | Contains GK slot + outfield player cards; shows player count |
| Bench | Blue tint | Shows player count |
| Absent | Muted grey | Shows player count |

### GK Slot

- A dedicated amber-bordered **GK** drop zone sits at the top of the Starting 11 column
- The coach drags one player into it to designate them as goalkeeper
- The GK player appears in the GK slot instead of the regular Starting 11 list (no duplicate)
- Dragging the GK player out of the slot clears the GK designation
- The GK slot is optional — the match can start without a GK assigned
- Only one player can occupy the GK slot at a time; dropping a new player replaces the previous one

---

## Drag and Drop

- Players are represented as compact cards showing the player's name
- Cards can be dragged between any of the three columns
- Both **touch drag** (mobile) and **mouse drag** (desktop) are supported
- The destination column highlights when a card is hovered over it
- The source card dims while being dragged
- A floating ghost clone follows the finger/cursor during the drag
- Dropping outside a valid zone cancels the drag with no change

---

## Validation

- At least 1 player must be in the Starting column to enable **Start Match**
- No upper limit is enforced on the Starting column (coach's discretion for reduced-format games), though 11 is standard
- No validation is applied to the Bench or Absent columns

---

## Starting the Match

- Tapping **Start Match** transitions directly to the Match Screen
- Players in the Starting column become **on pitch**
- Players in the Bench column become **on bench**
- Players in the Absent column are excluded entirely from the match

---

## Match Configuration

Above the column zones, two button-group selectors capture match format:

- **Periods**: `1` or `2` (default 2)
- **Mins/half**: `20`, `30`, `40`, or `45` (default 45)
- **Team size**: `5`, `7`, `9`, or `11` (default 11) — caters for futsal, 7-a-side, 9-a-side, full 11-a-side

The Starting column header updates immediately (e.g. "Starting 5" for futsal) and caps drops at the chosen size.

Selected option highlights in green. Values are applied when **Start Match** is tapped.

## Adding Fill-In Players

- A text input and **+** button sit below the three columns
- Typing a name and tapping **+** (or pressing Enter) adds the player to the Absent column
- Fill-in players can then be dragged into Starting 11 or Bench like any regular player
- Duplicate names are rejected with an error message

## Header

- Displays the team logo (Castlemaine Goldfields FC) top-left
- Displays app title "Sub Manager" and subtitle "Drag players to assign roles"
