import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import type { ActivitySeason } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { useBackfillFillGrow } from './animations/useBackfillFillGrow'
import { usePrimevalFillFade } from './animations/usePrimevalFillFade'
import { useSeasonIndicatorSlide } from './animations/useSeasonIndicatorSlide'
import { type SeasonBar, seasonBar } from './season-bar'
import { styles } from './SeasonTimeline.style'

const DAY_MS = 24 * 60 * 60 * 1000

function seasonDays(seasons: readonly ActivitySeason[], index: number, now: number): number {
  const startsAt = Date.parse(seasons[index].startsAt)
  const next = seasons[index + 1]
  const endsAt = next !== undefined ? Date.parse(next.startsAt) : now

  return Math.max(1, Math.round((endsAt - startsAt) / DAY_MS))
}

function BackfillBar({ progress }: { progress: number }): React.JSX.Element {
  const fillRef = useRef<HTMLElement>(null)
  useBackfillFillGrow(fillRef, progress)

  return (
    <i {...stylex.props(styles.bar, styles.barOff)}>
      <i ref={fillRef} {...stylex.props(styles.fill)} />
    </i>
  )
}

function filledLength(bar: SeasonBar): number {
  switch (bar.state) {
    case 'ready':
      return 1
    case 'locked':
      return 0
    case 'backfill':
      return bar.progress
  }
}

function SeasonButton({
  season,
  days,
  selected,
  onSelect,
  onBackfill
}: {
  season: ActivitySeason
  days: number
  selected: boolean
  onSelect: (seasonId: number) => void
  onBackfill: (seasonId: number) => void
}): React.JSX.Element {
  const bar: SeasonBar = seasonBar(season)
  const running = bar.state === 'backfill' && bar.running
  const primevalRef = useRef<HTMLElement>(null)
  usePrimevalFillFade(primevalRef, filledLength(bar), running)

  function handleClick(): void {
    if (bar.state === 'ready' && !selected) {
      onSelect(season.id)
    }

    if (bar.state === 'backfill' && !bar.running) {
      onBackfill(season.id)
    }
  }

  return (
    <button
      type="button"
      disabled={bar.state === 'locked'}
      aria-disabled={running ? 'true' : undefined}
      aria-busy={running ? 'true' : undefined}
      aria-current={selected ? 'true' : undefined}
      onClick={handleClick}
      {...stylex.props(styles.season, stylex.defaultMarker(), styles.length(days))}
    >
      {bar.state === 'backfill' ? (
        <BackfillBar progress={bar.progress} />
      ) : (
        <i
          {...stylex.props(
            styles.bar,
            selected && styles.barOn,
            bar.state === 'locked' && styles.barOff
          )}
        />
      )}
      {/* 받기가 끝나 막대가 바뀌어도 이 층은 남아 태초색이 서서히 사라지도록 막대 밖에 둔다. */}
      <i ref={primevalRef} aria-hidden="true" {...stylex.props(styles.primevalFill)} />
      <span
        {...stylex.props(styles.name, selected && styles.nameOn, !season.available && styles.off)}
      >
        {season.name}
      </span>
      {bar.state === 'backfill' && (
        <span {...stylex.props(shapes.srOnly)}>{Math.floor(bar.progress * 100)}%</span>
      )}
    </button>
  )
}

export function SeasonTimeline({
  seasons,
  selectedId,
  onSelect,
  onBackfill
}: {
  seasons: readonly ActivitySeason[]
  selectedId: number
  onSelect: (seasonId: number) => void
  onBackfill: (seasonId: number) => void
}): React.JSX.Element {
  const [now] = useState(Date.now)
  const timelineRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const hasSelection = seasons.some(({ id }) => id === selectedId)
  useSeasonIndicatorSlide({ timelineRef, indicatorRef, selectedId, seasons, hasSelection })

  return (
    <nav ref={timelineRef} aria-label="시즌" {...stylex.props(styles.timeline)}>
      {hasSelection && (
        <span ref={indicatorRef} aria-hidden="true" {...stylex.props(styles.indicator)} />
      )}
      {seasons.map((season, index) => (
        <SeasonButton
          key={season.id}
          season={season}
          days={seasonDays(seasons, index, now)}
          selected={season.id === selectedId}
          onSelect={onSelect}
          onBackfill={onBackfill}
        />
      ))}
    </nav>
  )
}
