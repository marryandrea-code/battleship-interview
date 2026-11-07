# Battleship

A browser Battleship game: you against an AI opponent.

## Development

```sh
npm install
npm run dev        # start the dev server
npm run check      # lint, typecheck, format check, unit tests
npm run build      # production build in dist/
```

## Project layout

- `src/engine/` — pure TypeScript game rules (board, placement, shots, state machine). No React or DOM imports, fully unit tested.
- `src/app/` — React UI.

## Rules

Standard 10x10 board with a fleet of five ships (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2). Ships may touch but not overlap. Players alternate one shot per turn; the first to sink the opposing fleet wins.
