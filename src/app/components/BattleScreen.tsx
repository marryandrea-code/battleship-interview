import { useEffect, useRef } from 'react'
import {
  FLEET_BY_KIND,
  coordLabel,
  countHits,
  countShots,
  sunkShips,
  type Coord,
  type GameState,
} from '../../engine'
import { AI_PROFILES, type AiRank } from '../../engine/ai'
import type { LastShot, LogEntry } from '../state'
import Board from './Board'
import FleetStatus from './FleetStatus'

interface Props {
  readonly rank: AiRank
  readonly game: GameState
  readonly log: readonly LogEntry[]
  readonly lastShot: LastShot | null
  readonly aiThinking: boolean
  readonly onFire: (coord: Coord) => void
  readonly onRematch: () => void
  readonly onChangeOpponent: () => void
}

export default function BattleScreen({
  rank,
  game,
  log,
  lastShot,
  aiThinking,
  onFire,
  onRematch,
  onChangeOpponent,
}: Props) {
  const profile = AI_PROFILES[rank]
  const playerBoard = game.boards.player!
  const enemyBoard = game.boards.ai
  const finished = game.phase === 'finished'
  const playerTurn = game.turn === 'player' && !finished
  const enemySunk = sunkShips(enemyBoard)
  const enemySunkKinds = new Set(enemySunk.map((s) => s.kind))
  const playerSunkKinds = new Set(sunkShips(playerBoard).map((s) => s.kind))
  const enemyLast = lastShot?.by === 'player' ? lastShot : null
  const playerLast = lastShot?.by === 'ai' ? lastShot : null
  const playerShots = countShots(enemyBoard)
  const playerHits = countHits(enemyBoard)
  const accuracy = playerShots ? Math.round((playerHits / playerShots) * 100) : 0

  const shakeKey = playerLast?.result.kind === 'hit' ? playerLast.id : 0

  let status: string
  if (finished) {
    status =
      game.winner === 'player'
        ? 'Victory. Enemy fleet destroyed.'
        : `Defeat. ${profile.name} sank your fleet.`
  } else if (playerTurn) {
    status = 'Your turn. Pick a cell on the enemy grid.'
  } else {
    status = `${profile.name} is taking aim`
  }

  return (
    <section className="rise-in mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <header className="panel flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-3">
        <div>
          <p className="text-mist font-mono text-xs tracking-widest uppercase">Engagement</p>
          <p className="text-lg font-semibold">
            You <span className="text-mist">vs</span> {profile.name}{' '}
            <span className="text-amber font-mono text-xs uppercase">“{profile.callsign}”</span>
          </p>
        </div>
        <p
          className={`flex items-center gap-2 text-base font-semibold ${
            playerTurn ? 'text-radar' : 'text-foam'
          }`}
          aria-hidden="true"
        >
          {status}
          {!finished && !playerTurn && aiThinking ? (
            <span className="thinking-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : null}
        </p>
        <p className="text-mist font-mono text-xs">
          Shots {playerShots} · Hits {playerHits} · {accuracy}%
        </p>
      </header>

      <div className="battle-grid grid gap-6 lg:grid-cols-[1fr_minmax(0,16rem)_1fr]">
        <div className="flex w-fit flex-col gap-3 justify-self-center">
          <h2 className="text-radar text-center text-sm font-semibold tracking-[0.3em] uppercase">
            Enemy waters
          </h2>
          <div
            className={`panel rounded-xl p-3 ${playerTurn ? 'ring-1 ring-[var(--color-radar)]' : ''}`}
          >
            <Board
              title="Enemy waters"
              shots={enemyBoard.shots}
              ships={enemyBoard.ships.filter((s) => enemySunkKinds.has(s.kind))}
              sunkKinds={enemySunkKinds}
              lastShot={enemyLast ? { coord: enemyLast.coord, id: enemyLast.id } : null}
              interactive={playerTurn}
              radar
              radarPaused={!playerTurn}
              canSelect={(c) => enemyBoard.shots[c.row * 10 + c.col] === 'unknown'}
              onSelect={onFire}
              describeCell={(coord, state, ship) => {
                const label = coordLabel(coord)
                if (state === 'miss') return `${label}, miss`
                if (state === 'hit')
                  return ship
                    ? `${label}, hit, ${FLEET_BY_KIND[ship.kind].name} sunk`
                    : `${label}, hit`
                return `${label}, unexplored. Press Enter to fire.`
              }}
            />
          </div>
          <FleetStatus title="Enemy fleet" board={enemyBoard} hidden />
        </div>

        <div className="order-last flex min-w-0 flex-col gap-3 lg:order-none lg:w-72">
          <BattleLog log={log} />
        </div>

        <div className="flex w-fit flex-col gap-3 justify-self-center">
          <h2 className="text-mist text-center text-sm font-semibold tracking-[0.3em] uppercase">
            Your waters
          </h2>
          <div key={shakeKey} className={`panel rounded-xl p-3 ${shakeKey ? 'shake' : ''}`}>
            <Board
              title="Your waters"
              shots={playerBoard.shots}
              ships={playerBoard.ships}
              sunkKinds={playerSunkKinds}
              lastShot={playerLast ? { coord: playerLast.coord, id: playerLast.id } : null}
            />
          </div>
          <FleetStatus title="Your fleet" board={playerBoard} />
        </div>
      </div>

      {finished ? (
        <GameOver
          won={game.winner === 'player'}
          rank={rank}
          shots={playerShots}
          accuracy={accuracy}
          enemyShots={countShots(playerBoard)}
          onRematch={onRematch}
          onChangeOpponent={onChangeOpponent}
        />
      ) : null}
    </section>
  )
}

function BattleLog({ log }: { log: readonly LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [log.length])
  const tones: Record<LogEntry['tone'], string> = {
    miss: 'text-mist',
    hit: 'text-amber',
    sunk: 'text-fire font-semibold',
    info: 'text-radar',
  }
  return (
    <div className="panel flex h-full max-h-[70vh] min-h-48 flex-col rounded-xl p-4">
      <h3 className="text-mist mb-2 font-mono text-xs tracking-widest uppercase">Comms log</h3>
      <ol
        ref={ref}
        className="flex flex-1 flex-col gap-1.5 overflow-y-auto text-sm"
        aria-label="Battle log"
      >
        {log.map((e) => (
          <li key={e.id} className={`fade-in ${tones[e.tone]}`}>
            {e.text}
          </li>
        ))}
      </ol>
    </div>
  )
}

function GameOver({
  won,
  rank,
  shots,
  accuracy,
  enemyShots,
  onRematch,
  onChangeOpponent,
}: {
  won: boolean
  rank: AiRank
  shots: number
  accuracy: number
  enemyShots: number
  onRematch: () => void
  onChangeOpponent: () => void
}) {
  const profile = AI_PROFILES[rank]
  const primaryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    primaryRef.current?.focus()
  }, [])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      className="fade-in fixed inset-0 z-50 grid place-items-center bg-[rgba(4,9,19,0.8)] p-4 backdrop-blur-sm"
    >
      <div className="panel rise-in w-full max-w-md rounded-2xl p-8 text-center">
        <p className="text-mist font-mono text-xs tracking-[0.4em] uppercase">
          {won ? 'Mission complete' : 'Mission failed'}
        </p>
        <h2
          id="gameover-title"
          className={`title-glow mt-2 text-5xl font-bold tracking-widest uppercase ${
            won ? 'text-radar' : 'text-fire'
          }`}
        >
          {won ? 'Victory' : 'Defeat'}
        </h2>
        <p className="text-foam/80 mt-4">
          {won
            ? `You sank ${profile.name}'s fleet in ${shots} shots (${accuracy}% accuracy). ${profile.name} got off ${enemyShots} shots.`
            : `${profile.name} found your last ship in ${enemyShots} shots. You fired ${shots} (${accuracy}% accuracy).`}
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button ref={primaryRef} type="button" className="btn btn-primary" onClick={onRematch}>
            Rematch
          </button>
          <button type="button" className="btn btn-ghost" onClick={onChangeOpponent}>
            Change opponent
          </button>
        </div>
      </div>
    </div>
  )
}
