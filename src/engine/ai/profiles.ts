import type { AiProfile, AiRank } from './types'

export const AI_PROFILES: Readonly<Record<AiRank, AiProfile>> = {
  ensign: {
    rank: 'ensign',
    level: 1,
    name: 'Ensign Pip',
    callsign: 'Greenhorn',
    bio: 'Fresh out of the academy and firing on instinct. Forgets where the last shell landed.',
    tactics: 'Shoots at random and never follows up a hit.',
    thinkMs: [350, 700],
  },
  lieutenant: {
    rank: 'lieutenant',
    level: 2,
    name: 'Lieutenant Reyes',
    callsign: 'Bloodhound',
    bio: 'Methodical. Sweeps the grid in a checkerboard and, once she draws blood, does not let go.',
    tactics: 'Searches every other cell, then walks along a hit until the ship goes down.',
    thinkMs: [500, 900],
  },
  commander: {
    rank: 'commander',
    level: 3,
    name: 'Commander Okafor',
    callsign: 'Cartographer',
    bio: 'Keeps a running map of where your fleet could still be hiding and fires where the odds are best.',
    tactics:
      'Hunts by probability: targets the cell your remaining ships could occupy in the most ways.',
    thinkMs: [700, 1200],
  },
  admiral: {
    rank: 'admiral',
    level: 4,
    name: 'Admiral Voss',
    callsign: 'Oracle',
    bio: 'Every shot is a calculated inference. Spreads her own fleet so one hit never betrays the next ship.',
    tactics:
      'Full probability targeting on every shot, with her fleet placed so ships never touch.',
    thinkMs: [900, 1500],
  },
}
