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

## Bugs found and how they were fixed

Short answer to "what bugs did you find, and how were they fixed?" — the full write-up with symptoms, root causes and verification is in [DEBUGGING.md](DEBUGGING.md).

| Where  | Bug                                                                            | How it was found        | Fix                                                                                                      |
| ------ | ------------------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| AI     | Hunt/target line-following hardcoded the board size in its bounds check        | Code review             | Use the engine's shared `isInBounds` helper                                                              |
| AI     | Parity hunting kept a step of 2 after the Destroyer was sunk                   | Unit test               | Base the step on the smallest _remaining_ ship                                                           |
| AI     | A targeting test described an impossible board, so it failed seed-dependently  | Flaky test              | Rewrite the fixture with a legal board                                                                   |
| AI     | Admiral was no stronger than Commander (~44.9 vs ~44.7 shots)                  | `npm run sim` benchmark | Joint-density inference under a 100k search budget + spread-out fleet; Admiral now wins 55% head-to-head |
| UI     | Three `undefined`-not-handled type errors in `Board.tsx` / `state.ts`          | `tsc` strict mode       | Default the cell state, guard empty arrays and missing history                                           |
| UI     | `useCallback` called inside a conditional branch                               | ESLint `react-hooks`    | Hoist the hook to the top of `App`                                                                       |
| UI     | Boards + comms log overflowed the viewport at laptop widths                    | Browser screenshots     | Responsive `--cell` size and `minmax` grid column                                                        |
| UI     | Title heading wider than a phone screen, making the Deploy button unclickable  | Mobile Playwright run   | `clamp()` font size and tighter letter-spacing                                                           |
| Dev    | Shared dev-server preview returned Vite 403                                    | `curl`                  | Add the preview host to `allowedHosts`                                                                   |
| E2E    | Clicking a locked (`aria-disabled`) opponent card hung                         | Playwright              | `click({ force: true })`, then assert selection unchanged                                                |
| E2E    | Edge placement preview asserted 5 cells; board renders the 4 in bounds         | Playwright              | Fix the expectation (engine was right)                                                                   |
| E2E    | Log locator matched two entries when the AI fired first                        | Playwright strict mode  | `.first()`                                                                                               |
| E2E    | Full-match loop raced the game-over dialog                                     | Playwright timeout      | Wait on `dialog.or(nextCell)`                                                                            |
| E2E    | Campaign record "vanished" after reload                                        | Playwright              | Test bug: `addInitScript` cleared storage on every navigation                                            |
| Deploy | First GitHub Pages deploy failed with "Resource not accessible by integration" | Actions log             | Enable Pages (Source: GitHub Actions) once in repo settings, re-run                                      |

How bugs were caught, in order of how much each found: unit tests on the pure engine (53), the AI simulation harness, `tsc`/ESLint on every change, screenshots at several widths, and Playwright on desktop + phone — three of the e2e failures were in the tests themselves, each confirmed against the DOM before touching app code.

## Project layout

- `src/engine/` — pure TypeScript game rules (board, placement, shots, state machine). No React or DOM imports, fully unit tested.
- `src/engine/ai/` — the four AI ranks (random, parity hunt/target, probability heatmap, joint-density inference) and a simulation harness.
- `src/app/` — React UI: title, placement and battle screens, reducer-based state, campaign persistence, Web Audio sound.
- `e2e/` — Playwright tests.

## Rules

Standard 10x10 board with a fleet of five ships (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2). Ships may touch but not overlap. Players alternate one shot per turn; the first to sink the opposing fleet wins.
