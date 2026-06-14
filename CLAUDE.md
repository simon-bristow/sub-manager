# Sub Manager — Project Instructions

## Architecture (IMPORTANT)

The app is a **React + TypeScript + Vite** app living in `app/`, backed by Firebase
(Auth + Firestore) and deployed on Firebase Hosting. The old single-file vanilla
`index.html` app is retired — all current work happens in `app/src/`.

## Spec Maintenance (IMPORTANT)

Whenever a screen or behaviour in `app/src/` changes, **always update the relevant
spec files** in `specs/` before ending the turn.

### Which spec to update

| Change area | Spec file |
|---|---|
| Setup screen (roster, GK slot, add player, drag-drop, bin) | `specs/spec-squad-setup.md` |
| Timer, halves, H/T overlay, F/T trigger | `specs/spec-match-timer.md` |
| Player cards, columns, sorting, GK badge, sub log column | `specs/spec-player-tracking.md` |
| Substitution flow, sub bar, staging, log | `specs/spec-substitutions.md` |
| Full time overlay, minutes table | `specs/spec-fulltime-summary.md` |
| App-wide changes (flow, constraints, screens, auth) | `specs/appspec.md` |
| Tech/stack/state/Firebase/PWA details | `specs/spec-tech.md` |

When in doubt, update `appspec.md` as well.

## Deployment

- React app in `app/` — build with `npm run build`, deploy with
  `npx firebase deploy --only hosting` (from `app/`)
- Hosted on Firebase Hosting: https://sub-manager-eb2b2.web.app
- Source control is GitHub; build artifacts (`dist/`) are not committed
- Specs live in `specs/` — commit them alongside code changes

## Version Number (IMPORTANT)

This app is a **pre-release candidate** — versions stay below v1.0.

**Before every commit**, increment the version by **0.01**.

The version lives in one source of truth plus the commit message:
1. `app/src/version.ts` — `export const APP_VERSION = 'v0.XX';` (consumed by both the
   bottom-right version badge and the About overlay)
2. The commit message suffix: include `; v0.XX` at the end

Current version after last commit: **v0.65**. Next commit should use **v0.66**, etc.

## Stack

- React 18 + TypeScript + Vite (no SSR)
- Zustand for state (`app/src/state/`), with match state persisted to localStorage
- `@dnd-kit/core` for squad-setup drag-and-drop
- Firebase v10 modular SDK (Auth + Firestore), `react-firebase-hooks`
- PWA via `vite-plugin-pwa`
- Styles ported to `app/src/styles.css` (single stylesheet, BEM-ish class names)
