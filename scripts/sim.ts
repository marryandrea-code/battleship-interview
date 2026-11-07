import { AI_RANKS } from '../src/engine/ai'
import { benchmarkMatchup, benchmarkRank } from '../src/engine/ai/simulate'

const games = Number(process.argv[2] ?? 1000)

console.log(`Shots to clear a random fleet (${games} games each)`)
for (const rank of AI_RANKS) {
  const s = benchmarkRank(rank, games)
  console.log(
    `  ${rank.padEnd(11)} mean ${s.meanShots.toFixed(1).padStart(5)}  min ${s.minShots}  max ${s.maxShots}`,
  )
}

console.log(
  `\nHead to head win rate of row vs column (${games} games each, alternating first move)`,
)
console.log('  '.padEnd(13) + AI_RANKS.map((r) => r.padStart(11)).join(''))
for (const a of AI_RANKS) {
  const cells = AI_RANKS.map((b) =>
    a === b
      ? '-'.padStart(11)
      : `${(benchmarkMatchup(a, b, games).aWinRate * 100).toFixed(0)}%`.padStart(11),
  )
  console.log(`  ${a.padEnd(11)}${cells.join('')}`)
}
