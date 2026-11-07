# Battleship build plan

Scope for v1: **Human vs AI** only. You place a fleet, pick one of four AI ranks, and play turn by turn. A campaign ladder and a stats page sit on top. Other modes (AI vs AI spectator, local two-player, online multiplayer, rule variants) are planned for later on the same engine.

## AI ranks (levels)

| Level | Rank       | How it plays                                                                                                                                                                                | Target avg shots to win |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1     | Ensign     | Random shots, never follows up a hit.                                                                                                                                                       | ~95                     |
| 2     | Lieutenant | Parity (checkerboard) hunting, then walks along a hit until the ship sinks.                                                                                                                 | ~50                     |
| 3     | Commander  | Hunts with a probability heatmap of where the remaining ships can still fit; finishes wounded ships by line-following.                                                                      | ~45                     |
| 4     | Admiral    | Exact enumeration of every arrangement of the remaining ships consistent with all shots when the search is small enough, otherwise the heatmap. Spreads her own fleet so ships never touch. | ~43                     |

Every rank plays fair: it only sees the same hit/miss/sunk information a human would (`PublicBoardView`). The simulation harness (`npm run sim`) measures shots-to-win and head-to-head win rates and the test suite asserts the ordering holds.

- Campaign ladder: beat each rank to unlock the next; 1 to 3 stars per win based on shots used.
- Stats: wins/losses per rank, best shot count, accuracy, streaks (localStorage, versioned).
- Each rank has a name, bio and a distinct thinking delay so they feel like different opponents.

## Design direction

- **Theme:** "command deck" — deep navy surfaces, phosphor-green radar accents, amber warnings, coral hits. One cohesive dark theme.
- **Boards:** two grids with A–J / 1–10 coordinates; your fleet shows silhouettes, the enemy grid shows fog until fired upon. Side by side on desktop, stacked with a sticky turn banner on mobile.
- **Feedback:** sonar ping on hover, ripple on miss, flash + shake + debris on hit, silhouette reveal and toast on sink, radar sweep while the AI thinks.
- **Placement:** drag ships from a dock, R or tap to rotate, invalid spots glow red, Randomize / Clear, tap-to-place fallback for touch.
- **Sound:** synthesized with Web Audio (no assets), persisted mute toggle.
- **Accessibility:** full keyboard play, ARIA live announcements, hit/miss differ by shape as well as color, honors `prefers-reduced-motion`, 44 px touch targets.
- **Screens:** Title (pick rank, campaign, stats) → Placement → Battle → Game over (result, shots, accuracy, stars, rematch / next rank).

## Architecture

```
src/engine/        pure TypeScript, no React or DOM imports
  types.ts         Coord, FLEET, Board, ShotResult, PublicBoardView
  board.ts         placement validation, createBoard, fire, publicView
  game.ts          createGame → startGame → takeShot state machine
  rng.ts           seeded PRNG so games and tests are deterministic
  ai/              AiStrategy per rank, shared analysis (density, hunt/target), simulate.ts
scripts/sim.ts     npm run sim — headless benchmark of the ranks
src/app/           React UI: store (useReducer), components, persistence
```

## Phases / PRs

1. **Scaffold + rules engine** — Vite, React, TypeScript, Tailwind, ESLint, Prettier, Vitest, GitHub Actions; engine with unit tests.
2. **AI ranks + simulation harness** — four strategies, `npm run sim`, tests asserting legality and difficulty ordering.
3. **Human vs AI UI** — design system, placement, battle, game over, animations, sound, accessibility.
4. **Campaign + stats** — ladder, unlocks, stars, stats page, persistence.
5. **QA, review, deploy** — Playwright end-to-end, accessibility audit, self review + Devin Review, GitHub Pages deploy.
6. **Later** — AI vs AI spectator, local two-player, online multiplayer, Salvo/Blitz variants, shareable replays.

## Decisions

- Vite + React 19 + TypeScript + Tailwind 4; Vitest + Playwright. No backend.
- Standard rules: 10×10, fleet 5/4/3/3/2, ships may touch, one shot per turn, a hit does not grant an extra shot.
- Engine isolated from React so the AI runs headless in tests and the simulator.
- One PR per phase, each CI-green and self-reviewed.
- Hosting on GitHub Pages via GitHub Actions.

## Risks

| Risk                                         | Mitigation                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Scope creep from extra modes                 | Everything outside Human vs AI gated behind a finished v1.                 |
| Drag-and-drop unreliable on touch            | Pointer events plus tap-to-place; tested at a mobile viewport.             |
| Animation hurts responsiveness/accessibility | CSS transforms only, reduced-motion honored, animations never block input. |
| Ranks not actually distinct                  | Simulation asserts win-rate ordering in CI.                                |
| Flaky tests from randomness                  | Seeded RNG everywhere.                                                     |
