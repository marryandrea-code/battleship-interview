import { coordKey, isInBounds, toIndex, type Coord, type PublicBoardView } from '../types'
import type { Rng } from '../rng'
import { activeHits, neighbors, unknownCells } from './analysis'

/**
 * Cells worth firing at next when some hits have not yet turned into a sink.
 * With two or more hits in a line, extend that line first; otherwise try the
 * four neighbours of each wounded cell.
 */
export function targetCandidates(view: PublicBoardView): Coord[] {
  const hits = activeHits(view)
  if (hits.length === 0) return []
  const isUnknown = (c: Coord) => view.shots[toIndex(c)] === 'unknown'
  const hitKeys = new Set(hits.map(coordKey))

  const lineEnds: Coord[] = []
  for (const h of hits) {
    const right = { row: h.row, col: h.col + 1 }
    const down = { row: h.row + 1, col: h.col }
    if (hitKeys.has(coordKey(right))) {
      lineEnds.push(...extendLine(h, 0, 1, hitKeys), ...extendLine(h, 0, -1, hitKeys))
    }
    if (hitKeys.has(coordKey(down))) {
      lineEnds.push(...extendLine(h, 1, 0, hitKeys), ...extendLine(h, -1, 0, hitKeys))
    }
  }
  const lineTargets = dedupe(lineEnds.filter((c) => isInBounds(c) && isUnknown(c)))
  if (lineTargets.length > 0) return lineTargets

  return dedupe(hits.flatMap(neighbors).filter(isUnknown))
}

function extendLine(from: Coord, dr: number, dc: number, hitKeys: Set<string>): Coord[] {
  let cur = from
  while (hitKeys.has(coordKey(cur))) cur = { row: cur.row + dr, col: cur.col + dc }
  return [cur]
}

function dedupe(cells: Coord[]): Coord[] {
  const seen = new Set<string>()
  return cells.filter((c) => {
    const k = coordKey(c)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Parity hunting: a ship of length L must cover one cell in every L-th
 * diagonal, so only those cells need to be searched (a checkerboard when the
 * shortest surviving ship is 2 long).
 */
export function parityCandidates(view: PublicBoardView): Coord[] {
  const lengths = view.remaining.map((s) => s.length)
  const smallest = lengths.length > 0 ? Math.min(...lengths) : 1
  const unknown = unknownCells(view)
  const parity = unknown.filter((c) => (c.row + c.col) % smallest === 0)
  return parity.length > 0 ? parity : unknown
}

export function huntTargetShot(view: PublicBoardView, rng: Rng): Coord {
  const targets = targetCandidates(view)
  if (targets.length > 0) return rng.pick(targets)
  return rng.pick(parityCandidates(view))
}
