import { useEffect, useRef, useState } from 'react'
import type { ActivitySeason } from '#entities/adventure-guild'
import { rarityGradientFills } from '#entities/character'
import { useBackfillFillGrow } from './animations/useBackfillFillGrow'
import { usePrimevalFillFade } from './animations/usePrimevalFillFade'
import { useSeasonIndicatorSlide } from './animations/useSeasonIndicatorSlide'
import { type SeasonBar, seasonBar } from './season-bar'

const DAY_MS = 24 * 60 * 60 * 1000

// 시즌 줄의 좌우 여백(px-4)이다. 고른 시즌으로 스크롤할 때 그 칸이 여백 안쪽에 보이게 한다.
const TIMELINE_INSET = 16

const BAR = 'absolute inset-x-0 top-0 h-1 rounded-[1px]'

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
    <i className={`${BAR} bg-inset`}>
      <i ref={fillRef} className="absolute inset-y-0 left-0 rounded-[1px] bg-line-strong" />
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

function barTone(bar: SeasonBar, selected: boolean): string {
  if (bar.state === 'locked') {
    return 'bg-inset'
  }

  if (selected) {
    return 'bg-line-strong'
  }

  return 'bg-line-strong group-hover:bg-line-input'
}

function nameTone(season: ActivitySeason, selected: boolean): string {
  if (!season.available) {
    return 'text-fg-subtle'
  }

  if (selected) {
    return 'text-fg'
  }

  return 'text-fg-muted group-hover:text-fg'
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
      className="group relative flex min-w-[84px] shrink basis-0 cursor-pointer flex-col items-start gap-1 px-0 pt-3 pb-0 text-left disabled:cursor-default aria-disabled:cursor-default"
      style={{ flexGrow: days }}
    >
      {bar.state === 'backfill' ? (
        <BackfillBar progress={bar.progress} />
      ) : (
        <i className={`${BAR} ${barTone(bar, selected)}`} />
      )}
      {/* 받기가 끝나 막대가 바뀌어도 이 층은 남아 태초색이 서서히 사라지도록 막대 밖에 둔다. */}
      <i
        ref={primevalRef}
        aria-hidden="true"
        className={`pointer-events-none absolute top-0 left-0 h-1 rounded-[1px] ${rarityGradientFills.primordial}`}
      />
      <span
        title={season.name}
        className={`max-w-full truncate text-xs ${selected ? 'font-semibold' : 'font-medium'} ${nameTone(season, selected)}`}
      >
        {season.name}
      </span>
      {bar.state === 'backfill' && (
        <span className="sr-only">{Math.floor(bar.progress * 100)}%</span>
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
  useSeasonIndicatorSlide({ timelineRef, indicatorRef })

  // 칸은 누르기 쉬운 84px보다 줄이지 않아 시즌이 많으면 시즌 줄만 가로로 스크롤하므로, 고른 시즌이 보이게 옮긴다.
  useEffect(() => {
    const timeline = timelineRef.current
    const selected = timeline?.querySelector<HTMLElement>('[aria-current="true"]')
    if (timeline == null || selected == null) {
      return
    }

    const left = selected.offsetLeft
    const right = left + selected.offsetWidth

    if (left < timeline.scrollLeft) {
      timeline.scrollLeft = left - TIMELINE_INSET
    } else if (right > timeline.scrollLeft + timeline.clientWidth) {
      timeline.scrollLeft = right - timeline.clientWidth + TIMELINE_INSET
    }
  }, [selectedId])

  return (
    <nav
      ref={timelineRef}
      aria-label="시즌"
      className="relative flex gap-1 overflow-x-auto px-4 pt-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {hasSelection && (
        <span
          ref={indicatorRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-3 z-raised h-1 rounded-[1px] bg-signal"
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
