import { useCallback, useRef, type KeyboardEvent } from 'react'
import {
  BOARD_SIZE,
  coordKey,
  coordLabel,
  toIndex,
  type CellState,
  type Coord,
  type PlacedShip,
} from '../../engine'

export interface CellDecoration {
  readonly className?: string
}

export interface BoardProps {
  /** Visible id used for aria-labelledby. */
  readonly title: string
  readonly shots: readonly CellState[]
  /** Ships to draw on the board (the player's own fleet, or sunk enemy ships). */
  readonly ships?: readonly PlacedShip[]
  /** Ship kinds that are sunk; their cells get the sunk treatment. */
  readonly sunkKinds?: ReadonlySet<string>
  /** Cells to draw as a placement preview. */
  readonly preview?: { readonly cells: readonly Coord[]; readonly ok: boolean } | null
  /** The most recent shot on this board, for the splash animation. */
  readonly lastShot?: { readonly coord: Coord; readonly id: number } | null
  readonly interactive?: boolean
  readonly radar?: boolean
  readonly radarPaused?: boolean
  readonly className?: string
  readonly canSelect?: (coord: Coord) => boolean
  readonly onSelect?: (coord: Coord) => void
  readonly onHover?: (coord: Coord | null) => void
  /** Description of a cell for screen readers, overriding the default. */
  readonly describeCell?: (coord: Coord, state: CellState, ship: PlacedShip | undefined) => string
}

const COLS = Array.from({ length: BOARD_SIZE }, (_, i) => i)

export default function Board({
  title,
  shots,
  ships = [],
  sunkKinds,
  preview,
  lastShot,
  interactive = false,
  radar = false,
  radarPaused = false,
  className = '',
  canSelect,
  onSelect,
  onHover,
  describeCell,
}: BoardProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const shipByCell = new Map<string, PlacedShip>()
  for (const ship of ships) for (const c of ship.cells) shipByCell.set(coordKey(c), ship)
  const previewKeys = new Set(preview?.cells.map(coordKey) ?? [])

  const focusCell = useCallback((coord: Coord) => {
    const el = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-row="${coord.row}"][data-col="${coord.col}"]`,
    )
    el?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, coord: Coord) => {
    const moves: Record<string, Coord> = {
      ArrowUp: { row: coord.row - 1, col: coord.col },
      ArrowDown: { row: coord.row + 1, col: coord.col },
      ArrowLeft: { row: coord.row, col: coord.col - 1 },
      ArrowRight: { row: coord.row, col: coord.col + 1 },
      Home: { row: coord.row, col: 0 },
      End: { row: coord.row, col: BOARD_SIZE - 1 },
    }
    const next = moves[e.key]
    if (!next) return
    e.preventDefault()
    const wrapped = {
      row: (next.row + BOARD_SIZE) % BOARD_SIZE,
      col: (next.col + BOARD_SIZE) % BOARD_SIZE,
    }
    focusCell(wrapped)
    onHover?.(wrapped)
  }

  const titleId = `${title.replace(/\s+/g, '-').toLowerCase()}-board`

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-labelledby={titleId}
      className={`board ${radar ? 'radar' : ''} ${radarPaused ? 'paused' : ''} ${
        interactive ? '' : 'disabled'
      } ${className}`}
      onMouseLeave={() => onHover?.(null)}
    >
      <span id={titleId} className="sr-only">
        {title}
      </span>
      <div className="board-label" aria-hidden="true" />
      {COLS.map((c) => (
        <div key={`c${c}`} className="board-label" aria-hidden="true">
          {c + 1}
        </div>
      ))}
      {COLS.map((row) => (
        <Row key={row} row={row}>
          {COLS.map((col) => {
            const coord = { row, col }
            const key = coordKey(coord)
            const state = shots[toIndex(coord)] ?? 'unknown'
            const ship = shipByCell.get(key)
            const sunk = ship ? (sunkKinds?.has(ship.kind) ?? false) : false
            const isLast =
              lastShot != null && lastShot.coord.row === row && lastShot.coord.col === col
            const selectable = interactive && (canSelect ? canSelect(coord) : true)
            const classes = ['cell', state]
            if (ship) {
              classes.push('ship', shipEdgeClass(ship, coord))
            }
            if (sunk) classes.push('sunk')
            if (previewKeys.has(key)) classes.push(preview!.ok ? 'preview-ok' : 'preview-bad')
            if (isLast) classes.push('last-shot')
            const label = describeCell
              ? describeCell(coord, state, ship)
              : defaultDescription(coord, state, ship, sunk)
            // Only one cell is in the tab order; arrows move between cells.
            const tabIndex = row === 0 && col === 0 ? 0 : -1
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                data-row={row}
                data-col={col}
                className={classes.join(' ')}
                aria-label={label}
                aria-disabled={!selectable}
                tabIndex={tabIndex}
                disabled={!interactive}
                onClick={() => selectable && onSelect?.(coord)}
                onMouseEnter={() => onHover?.(coord)}
                onFocus={() => onHover?.(coord)}
                onKeyDown={(e) => onKeyDown(e, coord)}
              >
                {isLast ? <span key={lastShot.id} className="ring" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </Row>
      ))}
    </div>
  )
}

function Row({ row, children }: { row: number; children: React.ReactNode }) {
  return (
    <>
      <div className="board-label" aria-hidden="true">
        {String.fromCharCode(65 + row)}
      </div>
      <div role="row" className="contents">
        {children}
      </div>
    </>
  )
}

function shipEdgeClass(ship: PlacedShip, coord: Coord): string {
  const first = ship.cells[0]
  const last = ship.cells[ship.cells.length - 1]
  if (!first || !last) return ''
  const h = ship.orientation === 'horizontal'
  if (first.row === coord.row && first.col === coord.col) return h ? 'bow-h' : 'bow-v'
  if (last.row === coord.row && last.col === coord.col) return h ? 'stern-h' : 'stern-v'
  return ''
}

function defaultDescription(
  coord: Coord,
  state: CellState,
  ship: PlacedShip | undefined,
  sunk: boolean,
): string {
  const parts = [coordLabel(coord)]
  if (state === 'miss') parts.push('miss')
  else if (state === 'hit') parts.push(sunk ? 'hit, ship sunk' : 'hit')
  else if (ship) parts.push(`your ${ship.kind}`)
  else parts.push('open water')
  return parts.join(', ')
}
