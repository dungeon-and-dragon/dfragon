import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ActivitySeason } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { type SeasonBar, seasonBar } from './season-bar'
import { styles } from './SeasonTimeline.style'

const DAY_MS = 24 * 60 * 60 * 1000

type Placement = Readonly<{ left: number; width: number; sliding: boolean }>

function seasonDays(seasons: readonly ActivitySeason[], index: number, now: number): number {
  const startsAt = Date.parse(seasons[index].startsAt)
  const next = seasons[index + 1]
  const endsAt = next !== undefined ? Date.parse(next.startsAt) : now

  return Math.max(1, Math.round((endsAt - startsAt) / DAY_MS))
}

function BackfillBar({ progress }: { progress: number }): React.JSX.Element {
  return (
    <i {...stylex.props(styles.bar, styles.barOff)}>
      <i {...stylex.props(styles.fill, styles.fillLength(progress))} />
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
      <i
        aria-hidden="true"
        {...stylex.props(
          styles.primevalFill,
          styles.fillLength(filledLength(bar)),
          running && styles.primevalOn
        )}
      />
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
  const [placement, setPlacement] = useState<Placement | null>(null)

  const placedRef = useRef(false)

  // 처음 그릴 때와 창 크기가 바뀔 때는 표시 막대를 미끄러지지 않고 고른 시즌 위에 바로 둔다.
  useLayoutEffect(() => {
    function place(sliding: boolean): void {
      const selected = timelineRef.current?.querySelector<HTMLElement>('[aria-current="true"]')
      setPlacement(
        selected != null
          ? { left: selected.offsetLeft, width: selected.offsetWidth, sliding }
          : null
      )
    }
    function placeWithoutSliding(): void {
      place(false)
    }

    place(placedRef.current)
    placedRef.current = true
    window.addEventListener('resize', placeWithoutSliding)

    return () => window.removeEventListener('resize', placeWithoutSliding)
  }, [selectedId, seasons])

  return (
    <nav ref={timelineRef} aria-label="시즌" {...stylex.props(styles.timeline)}>
      {placement !== null && (
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.indicator,
            placement.sliding && styles.sliding,
            styles.place(placement.left, placement.width)
          )}
        />
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
