import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_KEY,
  emptyCampaign,
  isUnlocked,
  loadCampaign,
  nextRank,
  recordMatch,
  saveCampaign,
  starsForShots,
} from './campaign'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  }
}

describe('campaign', () => {
  it('only the first rank is unlocked initially', () => {
    const c = emptyCampaign()
    expect(isUnlocked(c, 'ensign')).toBe(true)
    expect(isUnlocked(c, 'lieutenant')).toBe(false)
    expect(isUnlocked(c, 'admiral')).toBe(false)
  })

  it('winning unlocks the next rank exactly once and tracks best shots', () => {
    let c = emptyCampaign()
    const loss = recordMatch(c, 'ensign', false, 40)
    expect(loss.stars).toBe(0)
    expect(loss.unlocked).toBeNull()
    expect(loss.campaign.records.ensign.losses).toBe(1)

    const win = recordMatch(loss.campaign, 'ensign', true, 58)
    expect(win.unlocked).toBe('lieutenant')
    expect(win.stars).toBe(2)
    expect(win.newBest).toBe(true)
    c = win.campaign
    expect(isUnlocked(c, 'lieutenant')).toBe(true)

    const again = recordMatch(c, 'ensign', true, 70)
    expect(again.unlocked).toBeNull()
    expect(again.newBest).toBe(false)
    expect(again.campaign.records.ensign).toEqual({ wins: 2, losses: 1, bestShots: 58, stars: 2 })
  })

  it('star thresholds', () => {
    expect(starsForShots(17)).toBe(3)
    expect(starsForShots(45)).toBe(3)
    expect(starsForShots(46)).toBe(2)
    expect(starsForShots(60)).toBe(2)
    expect(starsForShots(61)).toBe(1)
    expect(starsForShots(100)).toBe(1)
  })

  it('nextRank walks the ladder', () => {
    expect(nextRank('ensign')).toBe('lieutenant')
    expect(nextRank('admiral')).toBeNull()
  })

  it('round-trips through storage and tolerates garbage', () => {
    const storage = memoryStorage()
    const c = recordMatch(emptyCampaign(), 'ensign', true, 50).campaign
    saveCampaign(c, storage)
    expect(loadCampaign(storage)).toEqual(c)

    expect(loadCampaign(memoryStorage({ [CAMPAIGN_KEY]: 'not json' }))).toEqual(emptyCampaign())
    expect(loadCampaign(memoryStorage({ [CAMPAIGN_KEY]: '{"version":2}' }))).toEqual(
      emptyCampaign(),
    )
    const partial = loadCampaign(
      memoryStorage({
        [CAMPAIGN_KEY]: JSON.stringify({
          version: 1,
          records: { ensign: { wins: 1, losses: 0, stars: 9 } },
        }),
      }),
    )
    expect(partial.records.ensign).toEqual({ wins: 1, losses: 0, bestShots: null, stars: 3 })
    expect(partial.records.admiral).toEqual({ wins: 0, losses: 0, bestShots: null, stars: 0 })
    expect(loadCampaign(null)).toEqual(emptyCampaign())
  })
})
