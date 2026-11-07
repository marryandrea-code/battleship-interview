import { AI_RANKS, type AiRank } from '../engine/ai'

export const CAMPAIGN_KEY = 'battleship.campaign.v1'

export interface RankRecord {
  readonly wins: number
  readonly losses: number
  /** Fewest shots used to win, or null if never won. */
  readonly bestShots: number | null
  /** Best star rating earned (0-3). */
  readonly stars: number
}

export interface Campaign {
  readonly version: 1
  readonly records: Readonly<Record<AiRank, RankRecord>>
}

const EMPTY_RECORD: RankRecord = { wins: 0, losses: 0, bestShots: null, stars: 0 }

export function emptyCampaign(): Campaign {
  return {
    version: 1,
    records: Object.fromEntries(AI_RANKS.map((r) => [r, EMPTY_RECORD])) as Record<
      AiRank,
      RankRecord
    >,
  }
}

export function loadCampaign(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Campaign {
  if (!storage) return emptyCampaign()
  try {
    const raw = storage.getItem(CAMPAIGN_KEY)
    if (!raw) return emptyCampaign()
    const parsed = JSON.parse(raw) as Partial<Campaign>
    if (parsed.version !== 1 || typeof parsed.records !== 'object' || !parsed.records) {
      return emptyCampaign()
    }
    const base = emptyCampaign()
    const records = { ...base.records }
    for (const rank of AI_RANKS) {
      const r = parsed.records[rank]
      if (r && typeof r.wins === 'number' && typeof r.losses === 'number') {
        records[rank] = {
          wins: r.wins,
          losses: r.losses,
          bestShots: typeof r.bestShots === 'number' ? r.bestShots : null,
          stars: typeof r.stars === 'number' ? Math.max(0, Math.min(3, r.stars)) : 0,
        }
      }
    }
    return { version: 1, records }
  } catch {
    return emptyCampaign()
  }
}

export function saveCampaign(
  campaign: Campaign,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
) {
  if (!storage) return
  try {
    storage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign))
  } catch {
    /* quota or privacy mode: stats simply do not persist */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The first rank is always open; each later rank unlocks by beating the one before it. */
export function isUnlocked(campaign: Campaign, rank: AiRank): boolean {
  const i = AI_RANKS.indexOf(rank)
  if (i <= 0) return true
  return campaign.records[AI_RANKS[i - 1]!]!.wins > 0
}

export function nextRank(rank: AiRank): AiRank | null {
  return AI_RANKS[AI_RANKS.indexOf(rank) + 1] ?? null
}

/**
 * Stars for a win, based on shots fired. 17 is the theoretical minimum (every
 * shot a hit); a human using hunt-and-target typically needs 50-70.
 */
export function starsForShots(shots: number): number {
  if (shots <= 45) return 3
  if (shots <= 60) return 2
  return 1
}

export interface MatchOutcome {
  readonly campaign: Campaign
  readonly stars: number
  readonly unlocked: AiRank | null
  readonly newBest: boolean
}

export function recordMatch(
  campaign: Campaign,
  rank: AiRank,
  won: boolean,
  shots: number,
): MatchOutcome {
  const prev = campaign.records[rank]
  const wasUnlockedNext = nextRank(rank) ? isUnlocked(campaign, nextRank(rank)!) : true
  const stars = won ? starsForShots(shots) : 0
  const newBest = won && (prev.bestShots === null || shots < prev.bestShots)
  const record: RankRecord = {
    wins: prev.wins + (won ? 1 : 0),
    losses: prev.losses + (won ? 0 : 1),
    bestShots: newBest ? shots : prev.bestShots,
    stars: Math.max(prev.stars, stars),
  }
  const next: Campaign = { version: 1, records: { ...campaign.records, [rank]: record } }
  const unlockedNow = nextRank(rank) && !wasUnlockedNext && isUnlocked(next, nextRank(rank)!)
  return { campaign: next, stars, unlocked: unlockedNow ? nextRank(rank) : null, newBest }
}
