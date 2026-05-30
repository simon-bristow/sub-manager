# Spec: Player Tracking

## Purpose

Give the coach a live, at-a-glance view of every player's current status and cumulative time on pitch during the match.

---

## Match Screen Layout

The match screen is divided into three columns that fill the full screen height:

| Column | Content |
|---|---|
| **Pitch** | Players currently on the field |
| **Bench** | Players available for substitution |
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
- **Time** — right-aligned, shows cumulative time on pitch in `MM:SS`
  - Green colour for players currently on pitch (actively accumulating time)
  - Muted colour for bench players (time is frozen)
- Cards are sorted by **time on pitch descending** — most-played player always appears at the top

---

## Sorting

- The pitch column re-sorts after every substitution
- The pitch column also re-sorts automatically every **60 seconds** while the clock is running, so the order stays accurate throughout the half
- Most-played player is always at the top, helping the coach spot who is due for a rest

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
  - One row per pair: player coming on (↑ green) and player coming off (↓ red)
  - Multiple pairs within the same event are separated by a subtle divider line
- Events are shown most-recent first (newest at top)
- The column header shows a count of total individual player swaps made
- The column scrolls independently if there are many entries

---

## Header

The match screen header (sticky, always visible) shows:

- Team logo (top-left)
- Half label ("1st Half" / "2nd Half")
- Live match clock (`MM:SS`)
- Control buttons: ▶/⏸, H/T (or F/T), ✕
