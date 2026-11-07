import { FLEET, type Board, type ShipKind } from '../../engine'

interface Props {
  readonly title: string
  readonly board: Board
  /** Hide ship names until they're sunk (enemy fleet). */
  readonly hidden?: boolean
}

export default function FleetStatus({ title, board, hidden = false }: Props) {
  const hitCount = (kind: ShipKind) => {
    const ship = board.ships.find((s) => s.kind === kind)
    if (!ship) return 0
    return ship.cells.filter((c) => board.shots[c.row * 10 + c.col] === 'hit').length
  }
  return (
    <div className="panel rounded-xl p-4">
      <h3 className="text-mist mb-3 font-mono text-xs tracking-widest uppercase">{title}</h3>
      <ul className="flex flex-col gap-2">
        {FLEET.map((spec) => {
          const hits = hitCount(spec.kind)
          const sunk = hits >= spec.length
          const shown = hidden ? (sunk ? spec.length - hits : 0) : spec.length - hits
          const pct = hidden && !sunk ? 100 : (shown / spec.length) * 100
          return (
            <li key={spec.kind} className="flex items-center gap-3 text-sm">
              <span className={`w-24 truncate ${sunk ? 'text-fire line-through' : ''}`}>
                {spec.name}
              </span>
              <span
                className={`health flex-1 ${sunk ? 'sunk' : ''}`}
                role="meter"
                aria-label={`${spec.name} ${sunk ? 'sunk' : hidden ? 'afloat' : `${spec.length - hits} of ${spec.length} intact`}`}
                aria-valuemin={0}
                aria-valuemax={spec.length}
                aria-valuenow={sunk ? 0 : hidden ? spec.length : spec.length - hits}
              >
                <span style={{ width: `${sunk ? 100 : pct}%` }} />
              </span>
              <span className="text-mist w-10 text-right font-mono text-xs">
                {sunk ? 'SUNK' : hidden ? `${spec.length}` : `${spec.length - hits}/${spec.length}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
