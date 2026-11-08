import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import gsap from 'gsap'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { cubicBezier, type Motion, useMotionAllowed } from '../../animations/gsap-motion'
import type { FameBar } from './stats-bars'
import { styles } from './StatsScreen.style'

const integer = new Intl.NumberFormat('ko-KR')

export type Bar = Readonly<{ key: string; name: string; value: number; share?: string }>

function percentOf(value: number, max: number): number {
  if (max <= 0) {
    return 0
  }

  return (value / max) * 100
}

export function RowBars({ bars }: { bars: readonly Bar[] }): React.JSX.Element {
  const max = Math.max(0, ...bars.map(({ value }) => value))

  return (
    <ul {...stylex.props(styles.rows)}>
      {bars.map((bar) => (
        <BarRow key={bar.key} bar={bar} percent={percentOf(bar.value, max)} />
      ))}
    </ul>
  )
}

function BarRow({
  bar: { name, value, share },
  percent
}: {
  bar: Bar
  percent: number
}): React.JSX.Element {
  const [active, setActive] = useState(false)
  const { anchorRef, tooltipRef, align } = useTooltipAlign<HTMLSpanElement>(active)

  function handleMouseEnter(): void {
    setActive(share != null)
  }

  function handleMouseLeave(): void {
    setActive(false)
  }

  return (
    <li
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...stylex.props(styles.row)}
    >
      <span {...stylex.props(styles.rowName)}>{name}</span>
      <span {...stylex.props(styles.track)}>
        <span ref={anchorRef} {...stylex.props(styles.bar, styles.barWidth(percent))}>
          {active && (
            <span
              ref={tooltipRef}
              aria-hidden="true"
              {...stylex.props(
                styles.tooltip,
                styles.rowTooltip,
                align === 'start' && styles.tooltipStart,
                align === 'end' && styles.tooltipEnd
              )}
            >
              <span {...stylex.props(styles.tooltipCount)}>{share}</span>
            </span>
          )}
        </span>
      </span>
      <span {...stylex.props(styles.value)}>{integer.format(value)}</span>
      {share != null && <span {...stylex.props(shapes.srOnly)}>{share}</span>}
    </li>
  )
}

function heightOf(ratio: number): string {
  if (ratio === 0) {
    return '0'
  }

  return `max(1px, ${ratio * 100}%)`
}

type TooltipAlign = 'center' | 'start' | 'end'

function alignWithin(anchorX: number, tooltip: HTMLElement, chart: HTMLElement): TooltipAlign {
  const chartBox = chart.getBoundingClientRect()
  const half = tooltip.offsetWidth / 2
  if (anchorX - half < chartBox.left) {
    return 'start'
  }

  if (anchorX + half > chartBox.right) {
    return 'end'
  }

  return 'center'
}

function useTooltipAlign<T extends HTMLElement>(
  active: boolean
): {
  anchorRef: React.RefObject<T | null>
  tooltipRef: React.RefObject<HTMLSpanElement | null>
  align: TooltipAlign
} {
  const [align, setAlign] = useState<TooltipAlign>('center')
  const anchorRef = useRef<T>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const chart = anchorRef.current?.closest('ul')
    if (!active || anchorRef.current == null || tooltipRef.current == null || chart == null) {
      setAlign('center')

      return
    }

    setAlign(
      alignWithin(anchorRef.current.getBoundingClientRect().right, tooltipRef.current, chart)
    )
  }, [active])

  return { anchorRef, tooltipRef, align }
}

const TOOLTIP_EASE = cubicBezier('fame-tooltip', '0.2,0,0,1')
const TOOLTIP_SLIDE: Motion = { seconds: 0.2, ease: TOOLTIP_EASE }
const TOOLTIP_FADE: Motion = { seconds: 0.12, ease: TOOLTIP_EASE }

type FameHover = Readonly<{ key: string | null; open: boolean }>

function tooltipXOf(column: HTMLElement, tooltip: HTMLElement, chart: HTMLElement): number {
  const origin = chart.getBoundingClientRect().left
  const columnBox = column.getBoundingClientRect()
  const min = (chart.firstElementChild ?? column).getBoundingClientRect().left - origin
  const max = (chart.lastElementChild ?? column).getBoundingClientRect().right - origin
  const center = columnBox.left - origin + columnBox.width / 2
  const width = tooltip.offsetWidth

  return gsap.utils.clamp(min, Math.max(min, max - width), center - width / 2)
}

// React가 툴팁의 transform, opacity, visibility를 inline style로 쓰면 tween 중간값이 덮이므로 GSAP만 쓴다.
function useFameTooltipSlide({
  chartRef,
  tooltipRef,
  columnsRef,
  shownKey,
  open,
  bars
}: {
  chartRef: React.RefObject<HTMLElement | null>
  tooltipRef: React.RefObject<HTMLElement | null>
  columnsRef: React.RefObject<ReadonlyMap<string, HTMLElement>>
  shownKey: string | undefined
  open: boolean
  bars: readonly FameBar[]
}): void {
  const allowed = useMotionAllowed()

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const chart = chartRef.current
    if (tooltip == null || chart == null) {
      return
    }

    const column = shownKey != null ? columnsRef.current.get(shownKey) : undefined
    if (!open || column == null) {
      if (allowed.current) {
        gsap.to(tooltip, {
          autoAlpha: 0,
          duration: TOOLTIP_FADE.seconds,
          ease: TOOLTIP_FADE.ease,
          overwrite: 'auto'
        })
      } else {
        gsap.set(tooltip, { autoAlpha: 0, overwrite: true })
      }

      return
    }

    const x = tooltipXOf(column, tooltip, chart)
    if (!allowed.current) {
      gsap.set(tooltip, { x, autoAlpha: 1, overwrite: true })

      return
    }

    const shown = Number(gsap.getProperty(tooltip, 'opacity')) > 0
    if (shown) {
      gsap.to(tooltip, {
        x,
        duration: TOOLTIP_SLIDE.seconds,
        ease: TOOLTIP_SLIDE.ease,
        overwrite: 'auto'
      })
    } else {
      gsap.set(tooltip, { x, overwrite: 'auto' })
    }

    gsap.to(tooltip, {
      autoAlpha: 1,
      duration: TOOLTIP_FADE.seconds,
      ease: TOOLTIP_FADE.ease,
      overwrite: 'auto'
    })
  }, [chartRef, tooltipRef, columnsRef, shownKey, open, bars, allowed])

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current

    return () => {
      if (tooltip != null) {
        gsap.killTweensOf(tooltip)
      }
    }
  }, [tooltipRef, bars])
}

export function FameColumns({ bars }: { bars: readonly FameBar[] }): React.JSX.Element {
  const [hover, setHover] = useState<FameHover>({ key: null, open: false })
  const chartRef = useRef<HTMLUListElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const columnsRef = useRef(new Map<string, HTMLLIElement>())
  const shownBar = bars.find(({ key }) => key === hover.key)
  useFameTooltipSlide({
    chartRef,
    tooltipRef,
    columnsRef,
    shownKey: shownBar?.key,
    open: hover.open,
    bars
  })

  function handleHover(key: string): void {
    setHover({ key, open: true })
  }

  function handleLeave(): void {
    setHover(({ key }) => ({ key, open: false }))
  }

  function registerColumn(key: string, element: HTMLLIElement): () => void {
    columnsRef.current.set(key, element)

    return () => {
      columnsRef.current.delete(key)
    }
  }

  return (
    <div {...stylex.props(styles.columnChart)}>
      <ul ref={chartRef} onMouseLeave={handleLeave} {...stylex.props(styles.columns)}>
        {bars.map((bar, index) => {
          const startsFine = bar.fine && bars[index - 1]?.fine === false

          return (
            <Fragment key={bar.key}>
              {startsFine && <li aria-hidden="true" {...stylex.props(styles.columnDivider)} />}
              <FameColumn
                bar={bar}
                active={hover.open && bar.key === hover.key}
                onHover={handleHover}
                register={registerColumn}
              />
            </Fragment>
          )
        })}
      </ul>
      <span
        ref={tooltipRef}
        aria-hidden="true"
        {...stylex.props(styles.tooltip, styles.columnTooltip)}
      >
        {shownBar != null && (
          <>
            <span {...stylex.props(styles.tooltipRange)}>{shownBar.range}</span>
            <span {...stylex.props(styles.tooltipCount)}>{integer.format(shownBar.count)}</span>
          </>
        )}
      </span>
    </div>
  )
}

function FameColumn({
  bar: { key, label, range, count, ratio },
  active,
  onHover,
  register
}: {
  bar: FameBar
  active: boolean
  onHover: (key: string) => void
  register: (key: string, element: HTMLLIElement) => () => void
}): React.JSX.Element {
  function handleMouseEnter(): void {
    onHover(key)
  }

  function columnRef(element: HTMLLIElement): () => void {
    return register(key, element)
  }

  return (
    <li ref={columnRef} onMouseEnter={handleMouseEnter} {...stylex.props(styles.column)}>
      <span {...stylex.props(shapes.srOnly)}>{`${range} ${integer.format(count)}`}</span>
      <span {...stylex.props(styles.columnTrack)}>
        <span
          {...stylex.props(
            styles.columnBar,
            active && styles.columnBarActive,
            styles.columnHeight(heightOf(ratio))
          )}
        />
      </span>
      <span aria-hidden="true" {...stylex.props(styles.columnLabel)}>
        {label != null && <span {...stylex.props(styles.columnLabelText)}>{label}</span>}
      </span>
    </li>
  )
}
