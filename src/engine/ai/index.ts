import { admiral, commander, ensign, lieutenant } from './strategies'
import type { AiRank, AiStrategy } from './types'

export * from './types'
export * from './profiles'
export { activeHits, densityMap, unknownCells } from './analysis'

const STRATEGIES: Readonly<Record<AiRank, AiStrategy>> = { ensign, lieutenant, commander, admiral }

export function getStrategy(rank: AiRank): AiStrategy {
  return STRATEGIES[rank]
}
