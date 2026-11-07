import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createRng, publicView, randomFleet, randomSeed, type Coord, type Rng } from './engine'
import { AI_PROFILES, getStrategy } from './engine/ai'
import { synth } from './app/audio'
import { initialState, reducer } from './app/state'
import BattleScreen from './app/components/BattleScreen'
import PlacementScreen from './app/components/PlacementScreen'
import TitleScreen from './app/components/TitleScreen'

export default function App() {
  const [state, dispatch] = useReducer(reducer, synth.muted, initialState)
  const rngRef = useRef<Rng>(createRng(randomSeed()))
  const [announcement, setAnnouncement] = useState('')

  const { screen, rank, game, lastShot, log } = state
  const rotate = useCallback(() => dispatch({ type: 'rotate' }), [])

  const startMatch = useCallback(() => {
    rngRef.current = createRng(randomSeed())
    const aiFleet = getStrategy(rank).placeFleet(rngRef.current)
    dispatch({ type: 'start-placement', aiFleet })
    synth.play('click')
  }, [rank])

  // AI turn: wait a human-feeling moment, then fire using only the public view.
  useEffect(() => {
    if (screen !== 'battle' || !game || game.phase !== 'playing' || game.turn !== 'ai') return
    const [min, max] = AI_PROFILES[rank].thinkMs
    const delay = min + Math.random() * (max - min)
    dispatch({ type: 'ai-thinking', thinking: true })
    const timer = setTimeout(() => {
      const board = game.boards.player
      if (!board) return
      const coord = getStrategy(rank).chooseShot(publicView(board), rngRef.current)
      dispatch({ type: 'fire', by: 'ai', coord })
    }, delay)
    return () => clearTimeout(timer)
  }, [screen, game, rank])

  // Sound + screen-reader announcements for each shot.
  useEffect(() => {
    if (!lastShot) return
    const { result } = lastShot
    if (result.kind === 'miss') synth.play('miss')
    else if (result.sunk) synth.play('sunk')
    else synth.play('hit')
    const entry = log[log.length - 1]
    if (entry) setAnnouncement(entry.text)
  }, [lastShot, log])

  useEffect(() => {
    if (game?.phase !== 'finished') return
    const timer = setTimeout(() => synth.play(game.winner === 'player' ? 'win' : 'lose'), 500)
    return () => clearTimeout(timer)
  }, [game?.phase, game?.winner])

  const toggleMute = () => {
    const muted = !state.muted
    synth.setMuted(muted)
    dispatch({ type: 'set-muted', muted })
    if (!muted) synth.play('click')
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <nav className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          className="text-mist font-mono text-xs tracking-[0.3em] uppercase hover:text-[var(--color-foam)]"
          onClick={() => {
            dispatch({ type: 'to-title' })
          }}
        >
          Battleship
        </button>
        <button
          type="button"
          className="btn btn-ghost px-3 py-1 text-xs"
          aria-pressed={state.muted}
          onClick={toggleMute}
        >
          {state.muted ? 'Sound off' : 'Sound on'}
        </button>
      </nav>

      <main className="flex flex-1 flex-col">
        {screen === 'title' ? (
          <TitleScreen
            rank={rank}
            onSelectRank={(r) => {
              dispatch({ type: 'select-rank', rank: r })
              synth.play('click')
            }}
            onStart={startMatch}
          />
        ) : null}

        {screen === 'placing' ? (
          <PlacementScreen
            rank={rank}
            fleet={state.fleet}
            selectedKind={state.selectedKind}
            orientation={state.orientation}
            onSelectShip={(kind) => dispatch({ type: 'select-ship', kind })}
            onRotate={rotate}
            onPlace={(kind, bow, orientation) => {
              dispatch({ type: 'place-ship', placement: { kind, bow, orientation } })
              synth.play('place')
            }}
            onPickUp={(kind) => dispatch({ type: 'pick-up-ship', kind })}
            onRandomize={() => {
              dispatch({ type: 'set-fleet', fleet: randomFleet(rngRef.current) })
              synth.play('place')
            }}
            onClear={() => dispatch({ type: 'clear-fleet' })}
            onBack={() => dispatch({ type: 'to-title' })}
            onBegin={() => {
              const first = rngRef.current.next() < 0.5 ? 'player' : 'ai'
              dispatch({ type: 'begin-battle', first })
              synth.play('click')
            }}
          />
        ) : null}

        {screen === 'battle' && game ? (
          <BattleScreen
            key={state.matchId}
            rank={rank}
            game={game}
            log={log}
            lastShot={lastShot}
            aiThinking={state.aiThinking}
            onFire={(coord: Coord) => {
              synth.play('fire')
              dispatch({ type: 'fire', by: 'player', coord })
            }}
            onRematch={startMatch}
            onChangeOpponent={() => dispatch({ type: 'to-title' })}
          />
        ) : null}
      </main>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  )
}
