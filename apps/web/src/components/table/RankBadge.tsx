const BADGE_RANKS = 3

export function RankBadge({ rank }: { rank: number }): React.JSX.Element {
  if (rank <= BADGE_RANKS) {
    return (
      <span className="badge min-w-6 justify-center bg-signal num font-semibold text-on-signal">
        {rank}
      </span>
    )
  }

  return <span className="num text-sm font-semibold text-fg-muted">{rank}</span>
}
