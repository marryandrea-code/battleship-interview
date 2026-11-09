# Debugging log: how bugs were found and fixed

This document records every defect found while building the game, how it was detected, the root cause, and the fix. It is organised by build phase (one phase per pull request) and ends with the general process we followed.

| # | Phase | Bug | Found by | Fix |
|---|---|---|---|---|
| 1 | Engine/AI | Hardcoded bounds check in hunt/target line-following | Code review | Use shared `isInBounds` helper |
| 2 | Engine/AI | Parity fallback used the wrong expression | Unit test | Base parity on the smallest *remaining* ship |
| 3 | Engine/AI | A targeting test asserted an impossible scenario | Test failure | Rewrite the test with a legal board |
| 4 | Engine/AI | Admiral not measurably stronger than Commander | Simulation harness | Joint-density enumeration with a search budget; document measured strength |
| 5 | UI | Three TypeScript strictness errors (`undefined` not handled) | `tsc -b` | Default/guard the values |
| 6 | UI | `useCallback` called conditionally | ESLint `react-hooks` | Hoist hook to top level |
| 7 | UI | Battle layout overflowed at laptop widths | Browser screenshot | Responsive cell size + grid columns |
| 8 | Deploy | Dev-server preview rejected by Vite (403) | `curl` | Add the preview host to `allowedHosts` |
| 9 | E2E | Locked opponent card could not be clicked in tests | Playwright | `click({ force: true })` on an `aria-disabled` control |
| 10 | E2E | Placement preview asserted 5 cells at a board edge | Playwright | Expect the 4 in-bounds cells |
| 11 | E2E | Log locator matched two entries | Playwright strict mode | `.first()` |
| 12 | E2E | Full-match loop raced the game-over dialog | Playwright timeout | Wait on `dialog.or(nextCell)` |
| 13 | E2E | Campaign record "lost" after reload | Playwright | Test bug: `addInitScript` cleared storage on every navigation |
| 14 | UI | Title overflowed on phones; Deploy button unclickable | Mobile e2e project | `clamp()` font size + tighter tracking |
| 15 | Deploy | First Pages deploy failed (403 enabling Pages) | Actions log | Pages must be enabled once in repo settings |

---

## Phase 1 — Rules engine ([PR #2](https://github.com/marryandrea-code/battleship-interview/pull/2))

**Approach.** The engine (`src/engine/`) is pure TypeScript with no React or DOM imports, so every rule could be unit-tested in isolation with Vitest before any UI existed. Tests were written for: board geometry (`toIndex`/`fromIndex`/`isInBounds`), ship placement (out-of-bounds, overlap, duplicates, touching allowed), firing (hit, miss, sunk, repeated shot, out-of-bounds shot), win detection, turn alternation, `publicView` hiding unsunk ships, and deterministic seeded RNG.

No defects were found in this phase after the tests passed; the value was in making later phases safe — every later refactor re-ran these 27 tests.

## Phase 2 — AI ranks ([PR #3](https://github.com/marryandrea-code/battleship-interview/pull/3))

### Bug 1 — Hardcoded bounds check in line-following
- **Symptom.** `huntTarget.ts` checked `row >= 0 && row < 10 && …` inline when extending a line of hits.
- **Found by.** Self-review of the diff before pushing.
- **Why it matters.** Duplicating the board size in a second place means a future change to `BOARD_SIZE` would silently break targeting.
- **Fix.** Replaced with the engine's `isInBounds(coord)` helper (`src/engine/ai/huntTarget.ts`).

### Bug 2 — Parity hunting used the wrong fallback
- **Symptom.** Lieutenant's checkerboard search should skip cells that cannot contain the *smallest remaining* ship. The first version used a fixed value and a wrong fallback expression, so once the Destroyer (length 2) was sunk it still searched with step 2 instead of 3.
- **Found by.** A unit test asserting that parity widens as small ships are sunk.
- **Fix.** Compute `Math.min(...view.remaining.map(s => s.length))` with an empty-fleet fallback.

### Bug 3 — Invalid test scenario
- **Symptom.** A targeting test hand-built a `PublicBoardView` whose hits could not correspond to any legal fleet, so the expected "next shot" was ambiguous and the test failed intermittently depending on RNG seed.
- **Found by.** Test failure; inspecting the fixture showed the scenario itself was impossible.
- **Fix.** Rewrote the fixture with a legal board and asserted the set of acceptable shots rather than a single cell.

### Bug 4 — Admiral was not measurably stronger than Commander
- **Symptom.** The headless simulator (`npm run sim`, 300 games per rank) showed Commander and Admiral finishing in ~44.7 vs ~44.9 shots: the top rank added nothing.
- **Found by.** The simulation harness, which also asserts the difficulty ordering in `ai.test.ts`.
- **Fix.** Admiral now enumerates joint placements of all remaining ships (`jointDensity`) when the search space is under `ADMIRAL_SEARCH_BUDGET = 100_000` leaves, falling back to the single-ship density map otherwise, and places its own fleet with no ships touching so one hit does not betray the next. Head-to-head it beats Commander 55% and Lieutenant 75% of the time. The solo-shot test between the top two ranks was relaxed and the real measurements were recorded in `PLAN.md` so nobody re-chases the same number.

## Phase 3 — Playable UI ([PR #4](https://github.com/marryandrea-code/battleship-interview/pull/4))

### Bug 5 — TypeScript strictness errors
```
Board.tsx(129): 'CellState | undefined' is not assignable to 'CellState'
Board.tsx(177): 'first' is possibly 'undefined'
state.ts(194):  'event' is possibly 'undefined'
```
- **Found by.** `npm run typecheck` (`tsc -b` with `noUncheckedIndexedAccess`).
- **Fix.** Default a missing cell to `'unknown'`, guard empty ship-cell arrays before reading first/last, and return the previous state if the shot history is unexpectedly empty.

### Bug 6 — Conditional React hook
- **Symptom.** `useCallback` for the rotate handler was created inside the `screen === 'placing'` branch.
- **Found by.** ESLint `react-hooks/rules-of-hooks`.
- **Fix.** Hoisted `const rotate = useCallback(...)` to the top of `App`.

### Bug 7 — Battle layout overflow
- **Symptom.** At ~1024–1280px the two boards plus the comms log were wider than the viewport, pushing the log off-screen.
- **Found by.** Playing the game in the browser and taking screenshots at several widths.
- **Fix.** Grid changed to `lg:grid-cols-[1fr_minmax(0,16rem)_1fr]` and the board cell size made responsive: `--cell: clamp(22px, 3.1vw, 44px)` above 64rem.

**Verification.** A Playwright script connected to the running browser and played an entire match by clicking unexplored cells until the dialog appeared ("You sank Ensign Pip's fleet in 88 shots"), proving the win flow, AI turn-taking and dialog worked end-to-end before merging.

### Bug 8 — Preview link returned HTTP 403
- **Symptom.** The shared dev-server preview showed Vite's "Blocked request. This host is not allowed."
- **Found by.** `curl -H "Host: <preview-host>" localhost:5173` — testing the link instead of assuming it worked.
- **Fix.** Restarted Vite with the preview hostname in `server.allowedHosts` (via `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`) and `--host 0.0.0.0`.

## Phase 4 — Campaign ladder ([PR #5](https://github.com/marryandrea-code/battleship-interview/pull/5))

No runtime defects. Risk was handled up front: `loadCampaign` validates every field and falls back to an empty campaign on bad JSON, an unknown schema version, or missing ranks, and clamps stars to 0–3. `campaign.test.ts` covers unlock rules, one-time unlock events, best-shot tracking, star thresholds and storage round-trip with garbage input. The reducer stays pure (`recordMatch` returns a new campaign); persistence happens in a single `useEffect`.

## Phase 5 — End-to-end tests and deployment ([PR #6](https://github.com/marryandrea-code/battleship-interview/pull/6))

The Playwright suite runs against the production build on two device profiles (Desktop Chrome and Pixel 7). The first run failed 9 of 10 tests; each failure was triaged from Playwright's call log and error-context snapshot.

### Bug 9 — Locked card "not enabled"
- **Symptom.** Clicking a locked opponent card hung until the test timed out.
- **Cause.** Locked cards carry `aria-disabled="true"`, which Playwright treats as not actionable.
- **Fix.** The test uses `click({ force: true })` and then asserts the selection did not change — which is exactly the behaviour under test.

### Bug 10 — Wrong expected preview count
- **Symptom.** Hovering A7 with the 5-cell Carrier expected 5 "invalid" preview cells; the board only renders the 4 that are in bounds.
- **Fix.** Expect 4. (The engine correctly rejects the placement; only the assertion was wrong.)

### Bug 11 — Strict-mode locator violation
- **Symptom.** `getByText(/Ensign Pip fired at/)` matched two log entries when the AI won the coin toss and fired first.
- **Fix.** `.first()`.

### Bug 12 — Race in the full-match loop
- **Symptom.** The loop checked `dialog.isVisible()` and then waited up to 10s for an enabled cell; if the dialog appeared between the two, it timed out.
- **Fix.** `await dialog.or(nextCell).first().waitFor()` then branch on which one appeared.

### Bug 13 — Campaign record "lost" after reload (test bug)
- **Symptom.** After winning, the title screen showed `1W 0L`, but after `page.reload()` it was gone.
- **Cause.** `test.beforeEach` used `page.addInitScript(() => localStorage.clear())`, which runs on *every* navigation, including the reload. The app's persistence was fine.
- **Fix.** Removed the hook; each Playwright test already gets a fresh browser context.

### Bug 14 — Title overflow on phones (real bug)
- **Symptom.** On the Pixel 7 profile the "Deploy" button was reported as "not stable" and later "intercepted" by a card paragraph.
- **Cause.** Screenshots showed the `h1` (`text-6xl` + `0.2em` letter-spacing) was wider than a 412px viewport, making the page horizontally scrollable and shifting layout as Playwright scrolled.
- **Fix.** `font-size: clamp(2.4rem, 11vw, 4.5rem)` with tighter tracking below the `sm` breakpoint. This bug would not have been caught without the mobile e2e project.

### Bug 15 — First Pages deploy failed
- **Symptom.** `actions/configure-pages` failed with `Resource not accessible by integration`.
- **Cause.** Creating a Pages site requires repository-admin rights that neither the automation token nor `GITHUB_TOKEN` has.
- **Fix.** Pages was enabled once in **Settings → Pages → Source: GitHub Actions**, the failed job was re-run, and the site came up at https://marryandrea-code.github.io/battleship-interview/.

---

## Process summary

1. **Pure core first.** Rules and AI are headless TypeScript, so they were tested with fast unit tests (53 today) before the UI existed.
2. **Seeded randomness.** Every random decision takes an explicit `Rng`, so failures reproduce exactly.
3. **Measure, don't guess.** The AI simulator turned "is Admiral harder?" into a number and caught the weakest design decision in the project.
4. **Static checks on every change.** `npm run check` = ESLint + `tsc -b` + Prettier + Vitest, run locally and in CI on every PR.
5. **Look at it.** Screenshots at several widths found the layout bugs that no type checker can.
6. **Automate the play-through.** A browser script played full matches before merging the UI, then became the Playwright suite.
7. **Trust but verify tooling.** Three of the e2e failures were in the tests, not the app; each was confirmed against a screenshot or the DOM before "fixing" application code.
8. **Small PRs, merged green.** Five PRs, each CI-green, so every regression had a short diff to bisect.
