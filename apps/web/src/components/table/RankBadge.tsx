const BADGE_RANKS = 3

export function RankBadge({ rank }: { rank: number }): React.JSX.Element {
  if (rank <= BADGE_RANKS) {
    return (
      <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-badge bg-signal px-2 font-mono text-xs font-semibold tabular-nums text-on-signal">
        {rank}
      </span>
    )
  }

  return <span className="font-mono text-sm font-semibold tabular-nums text-fg-muted">{rank}</span>
}
