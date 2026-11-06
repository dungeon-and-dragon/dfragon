import * as stylex from '@stylexjs/stylex'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ActivitySeason } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { formatSeasonYear } from './season-format'
import { styles } from './SeasonTimeline.style'

const DAY_MS = 24 * 60 * 60 * 1000

type Placement = Readonly<{ left: number; width: number; sliding: boolean }>

function seasonDays(seasons: readonly ActivitySeason[], index: number, now: number): number {
  const startsAt = Date.parse(seasons[index].startsAt)
  const next = seasons[index + 1]
  const endsAt = next !== undefined ? Date.parse(next.startsAt) : now

  return Math.max(1, Math.round((endsAt - startsAt) / DAY_MS))
}

function SeasonButton({
  season,
  days,
  selected,
  onSelect
}: {
  season: ActivitySeason
  days: number
  selected: boolean
  onSelect: (seasonId: number) => void
}): React.JSX.Element {
  function handleClick(): void {
    if (!selected) {
      onSelect(season.id)
    }
  }

  return (
    <button
      type="button"
      disabled={!season.available}
      aria-current={selected ? 'true' : undefined}
      onClick={handleClick}
      {...stylex.props(styles.season, stylex.defaultMarker(), styles.length(days))}
    >
      <i
        {...stylex.props(styles.bar, selected && styles.barOn, !season.available && styles.barOff)}
      />
      <span
        {...stylex.props(styles.name, selected && styles.nameOn, !season.available && styles.off)}
      >
        {season.name}
      </span>
      <span {...stylex.props(styles.year, !season.available && styles.off)}>
        시즌 {season.id}, {formatSeasonYear(season.startsAt)}
      </span>
    </button>
  )
}

export function SeasonTimeline({
  seasons,
  selectedId,
  onSelect
}: {
  seasons: readonly ActivitySeason[]
  selectedId: number
  onSelect: (seasonId: number) => void
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
        />
      ))}
    </nav>
  )
}
