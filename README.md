# Battleship

A browser Battleship game: you against an AI opponent.

**Play it:** https://marryandrea-code.github.io/battleship-interview/ (deployed from `main` by GitHub Actions).

## How to play

1. Pick an opponent. Only Ensign Pip is open at first; beat each rank to unlock the next.
2. Position your fleet: click a cell to place the selected ship, press `R` to rotate, click a placed ship to pick it up again, or hit Randomize.
3. Fire at the enemy grid. Red X = hit, dot = miss; a sunk ship is revealed. Sink all five ships before the AI sinks yours.
4. Wins earn stars: 3 for 45 shots or fewer, 2 for 60 or fewer, otherwise 1. Records are saved in your browser.

## Development

```sh
npm install
npm run dev        # start the dev server
npm run check      # lint, typecheck, format check, unit tests
npm run build      # production build in dist/
npm run test:e2e   # Playwright end-to-end tests (desktop + mobile)
npm run sim        # benchmark the AI ranks headlessly
```

See [PLAN.md](PLAN.md) for the full build plan, AI rank design and architecture.

## Project layout

- `src/engine/` — pure TypeScript game rules (board, placement, shots, state machine). No React or DOM imports, fully unit tested.
- `src/engine/ai/` — the four AI ranks (random, parity hunt/target, probability heatmap, joint-density inference) and a simulation harness.
- `src/app/` — React UI: title, placement and battle screens, reducer-based state, campaign persistence, Web Audio sound.
- `e2e/` — Playwright tests.

## Rules

Standard 10x10 board with a fleet of five ships (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2). Ships may touch but not overlap. Players alternate one shot per turn; the first to sink the opposing fleet wins.
