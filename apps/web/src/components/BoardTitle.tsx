export function BoardTitle({
  label,
  filled,
  total,
  round
}: {
  label: string
  filled: number
  total: number
  round: number | null
}): React.JSX.Element {
  return (
    <>
      <h1 className="m-0 shrink-0 text-base font-semibold tracking-heading text-fg">{label}</h1>
      <span className="shrink-0 num text-base font-semibold text-fg">
        {filled}
        <span className="text-fg-subtle">/{total}</span>
      </span>
      {round !== null && (
        <span
          aria-label={`${round}번째 ${label}`}
          role="img"
          className="shrink-0 num text-base font-semibold text-fg"
        >
          #{round}
        </span>
      )}
    </>
  )
}
