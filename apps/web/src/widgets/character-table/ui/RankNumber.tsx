const TOP_RANKS = 3

export function RankNumber({ rank }: { rank: number }): React.JSX.Element {
  const tone = rank <= TOP_RANKS ? 'text-fg' : 'text-fg-muted'

  return <span className={`num text-sm font-semibold ${tone}`}>{rank}</span>
}
