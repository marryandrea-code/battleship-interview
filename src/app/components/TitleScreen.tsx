import { AI_PROFILES, AI_RANKS, type AiRank } from '../../engine/ai'

interface Props {
  readonly rank: AiRank
  readonly onSelectRank: (rank: AiRank) => void
  readonly onStart: () => void
}

export default function TitleScreen({ rank, onSelectRank, onStart }: Props) {
  return (
    <section className="rise-in mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 py-10">
      <header className="text-center">
        <p className="text-radar mb-2 text-xs tracking-[0.5em] uppercase">Naval Command</p>
        <h1 className="title-glow text-6xl font-bold tracking-[0.2em] uppercase sm:text-7xl">
          Battleship
        </h1>
        <p className="text-mist mt-4 max-w-xl text-lg">
          Position your fleet, read the radar, and sink five enemy ships before the AI finds yours.
          Pick an opponent to begin.
        </p>
      </header>

      <div
        role="radiogroup"
        aria-label="Choose your opponent"
        className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {AI_RANKS.map((r) => {
          const p = AI_PROFILES[r]
          const selected = r === rank
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelectRank(r)}
              className={`panel group flex flex-col gap-3 rounded-xl p-5 text-left transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-radar)] ${
                selected ? 'ring-2 ring-[var(--color-radar)]' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-mist font-mono text-xs tracking-widest uppercase">
                  Level {p.level}
                </span>
                <span className="flex gap-1" aria-label={`Difficulty ${p.level} of 4`}>
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        i <= p.level ? 'bg-[var(--color-radar)]' : 'bg-[var(--color-line)]'
                      }`}
                    />
                  ))}
                </span>
              </div>
              <div>
                <h2 className="text-2xl leading-tight font-bold">{p.name}</h2>
                <p className="text-amber font-mono text-xs tracking-widest uppercase">
                  “{p.callsign}”
                </p>
              </div>
              <p className="text-foam/80 text-sm">{p.bio}</p>
              <p className="text-mist mt-auto border-t border-[var(--color-line)] pt-3 text-xs">
                <span className="text-radar font-semibold uppercase">Tactics · </span>
                {p.tactics}
              </p>
            </button>
          )
        })}
      </div>

      <button type="button" className="btn btn-primary px-10 py-3 text-base" onClick={onStart}>
        Deploy against {AI_PROFILES[rank].name}
      </button>
    </section>
  )
}
