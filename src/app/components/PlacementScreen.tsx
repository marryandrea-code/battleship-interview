import { useEffect, useMemo, useState } from 'react'
import {
  FLEET,
  FLEET_BY_KIND,
  checkPlacement,
  emptyShots,
  shipAt,
  shipCells,
  type Coord,
  type Orientation,
  type PlacedShip,
  type ShipKind,
} from '../../engine'
import { AI_PROFILES, type AiRank } from '../../engine/ai'
import Board from './Board'

interface Props {
  readonly rank: AiRank
  readonly fleet: readonly PlacedShip[]
  readonly selectedKind: ShipKind | null
  readonly orientation: Orientation
  readonly onSelectShip: (kind: ShipKind | null) => void
  readonly onRotate: () => void
  readonly onPlace: (kind: ShipKind, bow: Coord, orientation: Orientation) => void
  readonly onPickUp: (kind: ShipKind) => void
  readonly onRandomize: () => void
  readonly onClear: () => void
  readonly onBack: () => void
  readonly onBegin: () => void
}

const EMPTY_SHOTS = emptyShots()

export default function PlacementScreen({
  rank,
  fleet,
  selectedKind,
  orientation,
  onSelectShip,
  onRotate,
  onPlace,
  onPickUp,
  onRandomize,
  onClear,
  onBack,
  onBegin,
}: Props) {
  const [hover, setHover] = useState<Coord | null>(null)
  const complete = fleet.length === FLEET.length
  const placedKinds = useMemo(() => new Set(fleet.map((s) => s.kind)), [fleet])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return
        onRotate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRotate])

  const preview = useMemo(() => {
    if (!hover || !selectedKind) return null
    const spec = FLEET_BY_KIND[selectedKind]
    const cells = shipCells(hover, spec.length, orientation)
    const ok = checkPlacement(
      fleet,
      { kind: selectedKind, bow: hover, orientation },
      selectedKind,
    ).ok
    return { cells, ok }
  }, [hover, selectedKind, orientation, fleet])

  const board = { ships: fleet, shots: EMPTY_SHOTS }

  const handleSelect = (coord: Coord) => {
    const existing = shipAt(board, coord)
    if (selectedKind) {
      const ok = checkPlacement(
        fleet,
        { kind: selectedKind, bow: coord, orientation },
        selectedKind,
      ).ok
      if (ok) {
        onPlace(selectedKind, coord, orientation)
        return
      }
    }
    if (existing) onPickUp(existing.kind)
  }

  const selectedSpec = selectedKind ? FLEET_BY_KIND[selectedKind] : null

  return (
    <section className="rise-in mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-center text-3xl font-bold tracking-widest uppercase">
          Position your fleet
        </h1>
        <p className="text-mist text-center text-sm">
          {selectedSpec
            ? `Placing the ${selectedSpec.name} (${selectedSpec.length} cells, ${orientation}). Click or press Enter on a cell for its bow. Press R to rotate.`
            : complete
              ? 'All ships deployed. Click a ship to move it, or begin the battle.'
              : 'Select a ship from the dock.'}
        </p>
        <div className="panel rounded-xl p-3">
          <Board
            title="Your fleet"
            shots={EMPTY_SHOTS}
            ships={fleet}
            preview={preview}
            interactive
            onHover={setHover}
            onSelect={handleSelect}
            describeCell={(coord, _state, ship) => {
              const label = `${String.fromCharCode(65 + coord.row)}${coord.col + 1}`
              if (ship)
                return `${label}, your ${FLEET_BY_KIND[ship.kind].name}. Press Enter to pick it up.`
              if (selectedSpec) return `${label}. Place ${selectedSpec.name} bow here.`
              return `${label}, open water`
            }}
          />
        </div>
      </div>

      <aside className="flex flex-col gap-5">
        <div className="panel rounded-xl p-5">
          <h2 className="text-mist mb-3 font-mono text-xs tracking-widest uppercase">Dock</h2>
          <ul className="flex flex-col gap-2">
            {FLEET.map((spec) => {
              const placed = placedKinds.has(spec.kind)
              const selected = selectedKind === spec.kind
              return (
                <li key={spec.kind}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => (placed ? onPickUp(spec.kind) : onSelectShip(spec.kind))}
                    className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition ${
                      selected
                        ? 'border-[var(--color-radar)] bg-[rgba(56,225,255,0.12)]'
                        : 'border-[var(--color-line)] hover:border-[var(--color-radar-dim)]'
                    } ${placed ? 'opacity-70' : ''}`}
                  >
                    <span>
                      <span className="block font-semibold">{spec.name}</span>
                      <span className="text-mist text-xs">
                        {placed ? 'Deployed · click to move' : `${spec.length} cells`}
                      </span>
                    </span>
                    <span className="flex gap-0.5" aria-hidden="true">
                      {Array.from({ length: spec.length }, (_, i) => (
                        <span
                          key={i}
                          className={`h-3 w-3 rounded-sm ${
                            placed ? 'bg-[var(--color-radar-dim)]' : 'bg-[var(--color-line)]'
                          }`}
                        />
                      ))}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={onRotate}>
            Rotate <kbd className="text-mist font-mono text-xs">R</kbd>
          </button>
          <button type="button" className="btn btn-ghost" onClick={onRandomize}>
            Randomize
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onClear}
            disabled={fleet.length === 0}
          >
            Clear
          </button>
        </div>

        <div className="panel mt-auto flex flex-col gap-3 rounded-xl p-5">
          <p className="text-mist text-sm">
            Opponent: <span className="text-foam font-semibold">{AI_PROFILES[rank].name}</span>{' '}
            <span className="text-amber font-mono text-xs uppercase">
              “{AI_PROFILES[rank].callsign}”
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              Change opponent
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={onBegin}
              disabled={!complete}
            >
              {complete ? 'Begin battle' : `${FLEET.length - fleet.length} ships to place`}
            </button>
          </div>
        </div>
      </aside>
    </section>
  )
}
