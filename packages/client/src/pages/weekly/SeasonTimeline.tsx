import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import type { ActivitySeason } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { type SeasonBar, seasonBar } from './season-bar'
import { styles } from './SeasonTimeline.style'

gsap.registerPlugin(CustomEase)

const DAY_MS = 24 * 60 * 60 * 1000
const MOTION_QUERY = '(prefers-reduced-motion: no-preference)'

type Motion = Readonly<{ seconds: number; ease: gsap.EaseFunction }>
type Placement = Readonly<{ element: HTMLElement; left: number; width: number }>

const SLIDE: Motion = {
  seconds: 0.38,
  ease: CustomEase.create('season-indicator', '0.2,0.8,0.2,1')
}
const FILL_EASE = CustomEase.create('season-fill', '0.4,0,0.2,1')
const FILL: Motion = { seconds: 0.8, ease: FILL_EASE }
const FADE: Motion = { seconds: 0.5, ease: FILL_EASE }

function useMotionAllowed(): RefObject<boolean> {
  const allowed = useRef(false)

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add(MOTION_QUERY, () => {
      allowed.current = true

      return () => {
        allowed.current = false
      }
    })

    return () => media.revert()
  }, [])

  return allowed
}

// React가 이 속성을 inline style로 다시 쓰면 tween 중간값이 덮이므로 GSAP만 쓴다. 처음 값은 움직이지 않고 바로 둔다.
function useTweenedStyle(
  ref: RefObject<HTMLElement | null>,
  property: 'width' | 'opacity',
  value: string | number,
  motion: Motion,
  allowed: RefObject<boolean>
): void {
  const placedRef = useRef(false)

  useLayoutEffect(() => {
    const element = ref.current
    if (element == null) {
      return
    }

    if (placedRef.current && allowed.current) {
      gsap.to(element, { [property]: value, duration: motion.seconds, ease: motion.ease })
    } else {
      gsap.set(element, { [property]: value })
    }

    placedRef.current = true

    return () => {
      gsap.killTweensOf(element, property)
    }
  }, [ref, property, value, motion, allowed])
}

function fillWidth(progress: number): string {
  return `${progress * 100}%`
}

function seasonDays(seasons: readonly ActivitySeason[], index: number, now: number): number {
  const startsAt = Date.parse(seasons[index].startsAt)
  const next = seasons[index + 1]
  const endsAt = next !== undefined ? Date.parse(next.startsAt) : now

  return Math.max(1, Math.round((endsAt - startsAt) / DAY_MS))
}

function BackfillBar({
  progress,
  motionAllowed
}: {
  progress: number
  motionAllowed: RefObject<boolean>
}): React.JSX.Element {
  const fillRef = useRef<HTMLElement>(null)
  useTweenedStyle(fillRef, 'width', fillWidth(progress), FILL, motionAllowed)

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
  onBackfill,
  motionAllowed
}: {
  season: ActivitySeason
  days: number
  selected: boolean
  onSelect: (seasonId: number) => void
  onBackfill: (seasonId: number) => void
  motionAllowed: RefObject<boolean>
}): React.JSX.Element {
  const bar: SeasonBar = seasonBar(season)
  const running = bar.state === 'backfill' && bar.running
  const primevalRef = useRef<HTMLElement>(null)
  useTweenedStyle(primevalRef, 'width', fillWidth(filledLength(bar)), FILL, motionAllowed)
  useTweenedStyle(primevalRef, 'opacity', running ? 1 : 0, FADE, motionAllowed)

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
        <BackfillBar progress={bar.progress} motionAllowed={motionAllowed} />
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
  const placedRef = useRef<Placement | null>(null)
  const motionAllowed = useMotionAllowed()
  const hasSelection = seasons.some(({ id }) => id === selectedId)

  // 처음 그릴 때와 창 크기가 바뀔 때는 표시 막대를 미끄러지지 않고 고른 시즌 위에 바로 둔다.
  // 시즌을 고른 뒤 새 응답으로 다시 그려도 목표가 같으면 진행 중인 tween을 다시 시작하지 않는다.
  useLayoutEffect(() => {
    const indicator = indicatorRef.current
    const selected = timelineRef.current?.querySelector<HTMLElement>('[aria-current="true"]')
    if (indicator == null || selected == null) {
      return
    }

    function place(sliding: boolean): void {
      if (indicator == null || selected == null) {
        return
      }

      const placement = {
        element: indicator,
        left: selected.offsetLeft,
        width: selected.offsetWidth
      }
      const placed = placedRef.current
      if (
        placed?.element === indicator &&
        placed.left === placement.left &&
        placed.width === placement.width
      ) {
        return
      }

      placedRef.current = placement
      const vars = { left: placement.left, width: placement.width, overwrite: true }
      if (sliding && placed?.element === indicator && motionAllowed.current) {
        gsap.to(indicator, { ...vars, duration: SLIDE.seconds, ease: SLIDE.ease })
      } else {
        gsap.set(indicator, vars)
      }
    }
    function placeWithoutSliding(): void {
      place(false)
    }

    place(true)
    window.addEventListener('resize', placeWithoutSliding)

    return () => window.removeEventListener('resize', placeWithoutSliding)
  }, [selectedId, seasons, motionAllowed])

  useLayoutEffect(() => {
    const indicator = indicatorRef.current
    if (indicator == null) {
      return
    }

    return () => {
      gsap.killTweensOf(indicator)
    }
  }, [hasSelection])

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
          motionAllowed={motionAllowed}
        />
      ))}
    </nav>
  )
}
