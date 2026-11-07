import {
  FLEET,
  checkPlacement,
  coordLabel,
  createGame,
  placeShip,
  shotsBy,
  startGame,
  takeShot,
  type Coord,
  type GameState,
  type Orientation,
  type PlacedShip,
  type Player,
  type ShipKind,
  type ShipPlacement,
  type ShotResult,
} from '../engine'
import { AI_PROFILES, type AiRank } from '../engine/ai'
import { recordMatch, type Campaign, type MatchOutcome } from './campaign'

export type Screen = 'title' | 'placing' | 'battle'

export interface LogEntry {
  readonly id: number
  readonly by: Player
  readonly text: string
  readonly tone: 'miss' | 'hit' | 'sunk' | 'info'
}

export interface LastShot {
  readonly id: number
  readonly by: Player
  readonly coord: Coord
  readonly result: ShotResult
}

export interface AppState {
  readonly screen: Screen
  readonly rank: AiRank
  /** Incremented for every new match so effects/animations can reset. */
  readonly matchId: number
  readonly game: GameState | null
  readonly fleet: readonly PlacedShip[]
  readonly selectedKind: ShipKind | null
  readonly orientation: Orientation
  readonly log: readonly LogEntry[]
  readonly lastShot: LastShot | null
  readonly aiThinking: boolean
  readonly muted: boolean
  readonly campaign: Campaign
  /** Set when the current match finished; stars, unlocks, new best. */
  readonly outcome: MatchOutcome | null
}

export type Action =
  | { type: 'select-rank'; rank: AiRank }
  | { type: 'start-placement'; aiFleet: readonly ShipPlacement[] }
  | { type: 'select-ship'; kind: ShipKind | null }
  | { type: 'rotate' }
  | { type: 'place-ship'; placement: ShipPlacement }
  | { type: 'pick-up-ship'; kind: ShipKind }
  | { type: 'set-fleet'; fleet: readonly ShipPlacement[] }
  | { type: 'clear-fleet' }
  | { type: 'begin-battle'; first: Player }
  | { type: 'fire'; by: Player; coord: Coord }
  | { type: 'ai-thinking'; thinking: boolean }
  | { type: 'to-title' }
  | { type: 'set-muted'; muted: boolean }

export function initialState({
  muted,
  campaign,
}: {
  muted: boolean
  campaign: Campaign
}): AppState {
  return {
    campaign,
    outcome: null,
    screen: 'title',
    rank: 'ensign',
    matchId: 0,
    game: null,
    fleet: [],
    selectedKind: 'carrier',
    orientation: 'horizontal',
    log: [],
    lastShot: null,
    aiThinking: false,
    muted,
  }
}

export function nextUnplacedKind(fleet: readonly PlacedShip[]): ShipKind | null {
  const placed = new Set(fleet.map((s) => s.kind))
  return FLEET.find((s) => !placed.has(s.kind))?.kind ?? null
}

function describeShot(state: AppState, by: Player, coord: Coord, result: ShotResult): LogEntry {
  const id = state.log.length + 1
  const who = by === 'player' ? 'You' : AI_PROFILES[state.rank].name
  const at = coordLabel(coord)
  if (result.kind === 'miss') {
    return { id, by, text: `${who} fired at ${at}: miss.`, tone: 'miss' }
  }
  const shipName = FLEET.find((s) => s.kind === result.ship)?.name ?? result.ship
  const owner = by === 'player' ? 'the enemy' : 'your'
  if (result.sunk) {
    return {
      id,
      by,
      text: `${who} fired at ${at}: hit, and sank ${owner} ${shipName}!`,
      tone: 'sunk',
    }
  }
  return { id, by, text: `${who} fired at ${at}: hit!`, tone: 'hit' }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'select-rank':
      return { ...state, rank: action.rank }

    case 'start-placement':
      return {
        ...state,
        screen: 'placing',
        matchId: state.matchId + 1,
        game: createGame(action.aiFleet),
        fleet: [],
        selectedKind: 'carrier',
        orientation: 'horizontal',
        log: [],
        lastShot: null,
        aiThinking: false,
        outcome: null,
      }

    case 'select-ship':
      return { ...state, selectedKind: action.kind }

    case 'rotate':
      return {
        ...state,
        orientation: state.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      }

    case 'place-ship': {
      if (state.screen !== 'placing') return state
      const check = checkPlacement(state.fleet, action.placement, action.placement.kind)
      if (!check.ok) return state
      const fleet = [
        ...state.fleet.filter((s) => s.kind !== action.placement.kind),
        placeShip(action.placement),
      ]
      return { ...state, fleet, selectedKind: nextUnplacedKind(fleet) }
    }

    case 'pick-up-ship': {
      if (state.screen !== 'placing') return state
      const ship = state.fleet.find((s) => s.kind === action.kind)
      if (!ship) return state
      return {
        ...state,
        fleet: state.fleet.filter((s) => s.kind !== action.kind),
        selectedKind: action.kind,
        orientation: ship.orientation,
      }
    }

    case 'set-fleet': {
      if (state.screen !== 'placing') return state
      const fleet = action.fleet.map(placeShip)
      return { ...state, fleet, selectedKind: nextUnplacedKind(fleet) }
    }

    case 'clear-fleet':
      if (state.screen !== 'placing') return state
      return { ...state, fleet: [], selectedKind: 'carrier' }

    case 'begin-battle': {
      if (state.screen !== 'placing' || !state.game) return state
      if (state.fleet.length !== FLEET.length) return state
      const game = startGame(state.game, state.fleet, action.first)
      const opener =
        action.first === 'player'
          ? 'You won the coin toss. Fire when ready.'
          : `${AI_PROFILES[state.rank].name} won the coin toss and fires first.`
      return {
        ...state,
        screen: 'battle',
        game,
        selectedKind: null,
        log: [{ id: 1, by: action.first, text: opener, tone: 'info' }],
      }
    }

    case 'fire': {
      const { game } = state
      if (!game || game.phase !== 'playing' || game.turn !== action.by) return state
      const target = game.boards[action.by === 'player' ? 'ai' : 'player']
      if (!target || target.shots[action.coord.row * 10 + action.coord.col] !== 'unknown') {
        return state
      }
      const next = takeShot(game, action.by, action.coord)
      const event = next.history[next.history.length - 1]
      if (!event) return state
      const entry = describeShot(state, action.by, action.coord, event.result)
      const log = [...state.log, entry]
      let outcome = state.outcome
      let campaign = state.campaign
      if (next.phase === 'finished') {
        const won = next.winner === 'player'
        outcome = recordMatch(state.campaign, state.rank, won, shotsBy(next, 'player'))
        campaign = outcome.campaign
        log.push({
          id: log.length + 1,
          by: next.winner ?? 'player',
          text: won
            ? `Enemy fleet destroyed. Victory!`
            : `Your fleet has been sunk. ${AI_PROFILES[state.rank].name} wins.`,
          tone: 'info',
        })
      }
      return {
        ...state,
        game: next,
        log,
        campaign,
        outcome,
        aiThinking: false,
        lastShot: {
          id: next.history.length,
          by: action.by,
          coord: action.coord,
          result: event.result,
        },
      }
    }

    case 'ai-thinking':
      return { ...state, aiThinking: action.thinking }

    case 'to-title':
      return {
        ...state,
        screen: 'title',
        game: null,
        fleet: [],
        log: [],
        lastShot: null,
        aiThinking: false,
      }

    case 'set-muted':
      return { ...state, muted: action.muted }
  }
}
