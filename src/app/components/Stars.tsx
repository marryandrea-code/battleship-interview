interface Props {
  readonly count: number
  readonly max?: number
  readonly size?: 'sm' | 'lg'
}

export default function Stars({ count, max = 3, size = 'sm' }: Props) {
  return (
    <span
      className={`inline-flex gap-0.5 ${size === 'lg' ? 'text-3xl' : 'text-sm'}`}
      role="img"
      aria-label={`${count} of ${max} stars`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={
            i < count ? 'text-amber drop-shadow-[0_0_6px_rgba(255,184,77,0.8)]' : 'text-line'
          }
        >
          ★
        </span>
      ))}
    </span>
  )
}
