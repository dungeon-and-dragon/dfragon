const BADGE_RANKS = 3

export function RankBadge({ rank }: { rank: number }): React.JSX.Element {
  if (rank <= BADGE_RANKS) {
    return (
      <span className="badge min-w-6 justify-center bg-signal font-mono font-semibold tabular-nums text-on-signal">
        {rank}
      </span>
    )
  }

  return <span className="font-mono text-sm font-semibold tabular-nums text-fg-muted">{rank}</span>
}
