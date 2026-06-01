# Sub Manager — Project Instructions

## Spec Maintenance (IMPORTANT)

Whenever `index.html` is modified, **always update the relevant spec files** in `specs/` before ending the turn.

### Which spec to update

| Change area | Spec file |
|---|---|
| Setup screen (roster, GK slot, fill-in player, drag-drop) | `specs/spec-squad-setup.md` |
| Timer, halves, H/T overlay, F/T trigger | `specs/spec-match-timer.md` |
| Player cards, columns, sorting, GK badge | `specs/spec-player-tracking.md` |
| Substitution flow, sub bar, staging, log | `specs/spec-substitutions.md` |
| Full time overlay, minutes table | `specs/spec-fulltime-summary.md` |
| App-wide changes (flow, constraints, screens) | `specs/appspec.md` |

When in doubt, update `appspec.md` as well.

## Deployment

- Single file app: `index.html`
- Hosted on GitHub Pages: https://simon-bristow.github.io/sub-manager/
- Push changes with `git add index.html && git commit -m "..." && git push`
- Specs live in `specs/` — commit them alongside code changes

## Version Number (IMPORTANT)

**Before every commit**, increment the version number in `index.html` by 0.1.

The version lives in two places — update both:
1. The `<div id="about-overlay">` card: `<div class="about-version">vX.X</div>` (line ~896 in index.html)
2. The commit message suffix: include `; vX.X` at the end

Current version after last commit: **v2.0**. Next commit should use **v2.1**, then **v2.2**, etc.

## Stack

- Vanilla HTML/CSS/JS, no build step
- All assets (logo) embedded as base64 in `index.html`
- No backend, no persistence
