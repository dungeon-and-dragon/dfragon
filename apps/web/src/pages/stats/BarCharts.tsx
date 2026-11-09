import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import gsap from 'gsap'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { TOOLTIP_FADE, TOOLTIP_SLIDE, useMotionAllowed } from '../../animations/gsap-motion'
import { styles } from './StatsScreen.style'

const integer = new Intl.NumberFormat('ko-KR')

export type Bar = Readonly<{ key: string; name: string; value: number; share?: string }>

export type ColumnBar = Readonly<{
  key: string
  label: string | null
  range: string
  count: number
  share?: string
  ratio: number
  fine: boolean
}>

function percentOf(value: number, max: number): number {
  if (max <= 0) {
    return 0
  }

  return (value / max) * 100
}

type ShownTooltip = Readonly<{ key: string | null; open: boolean }>

const ROW_TOOLTIP_GAP = 8

export function RowBars({ bars }: { bars: readonly Bar[] }): React.JSX.Element {
  const [hover, setHover] = useState<ShownTooltip>({ key: null, open: false })
  const listRef = useRef<HTMLUListElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const barsRef = useRef(new Map<string, HTMLSpanElement>())
  const max = Math.max(0, ...bars.map(({ value }) => value))
  const hasShare = bars.some(({ share }) => share != null)
  const shownBar = bars.find(({ key }) => key === hover.key)
  useTooltipSlide({
    chartRef: listRef,
    tooltipRef,
    anchorsRef: barsRef,
    shownKey: shownBar?.key,
    open: hover.open,
    bars,
    placeOf: rowTooltipPlaceOf
  })

  function handleHover(key: string): void {
    setHover({ key, open: true })
  }

  function handleLeave(): void {
    setHover(({ key }) => ({ key, open: false }))
  }

  function registerBar(key: string, element: HTMLSpanElement): () => void {
    barsRef.current.set(key, element)

    return () => {
      barsRef.current.delete(key)
    }
  }

  return (
    <div {...stylex.props(styles.chart)}>
      <ul ref={listRef} onMouseLeave={handleLeave} {...stylex.props(styles.rows)}>
        {bars.map((bar) => (
          <BarRow
            key={bar.key}
            bar={bar}
            percent={percentOf(bar.value, max)}
            onHover={handleHover}
            register={registerBar}
          />
        ))}
      </ul>
      {hasShare && (
        <span ref={tooltipRef} aria-hidden="true" {...stylex.props(styles.tooltip)}>
          {shownBar?.share != null && (
            <span {...stylex.props(styles.tooltipCount)}>{shownBar.share}</span>
          )}
        </span>
      )}
    </div>
  )
}

function BarRow({
  bar: { key, name, value, share },
  percent,
  onHover,
  register
}: {
  bar: Bar
  percent: number
  onHover: (key: string) => void
  register: (key: string, element: HTMLSpanElement) => () => void
}): React.JSX.Element {
  function handleMouseEnter(): void {
    onHover(key)
  }

  function barRef(element: HTMLSpanElement): () => void {
    return register(key, element)
  }

  return (
    <li onMouseEnter={handleMouseEnter} {...stylex.props(styles.row)}>
      <span {...stylex.props(styles.rowName)}>{name}</span>
      <span {...stylex.props(styles.track)}>
        <span ref={barRef} {...stylex.props(styles.bar, styles.barWidth(percent))} />
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

type TooltipPlace = Readonly<{ x: number; y: number }>

type PlaceTooltip = (anchor: HTMLElement, tooltip: HTMLElement, chart: HTMLElement) => TooltipPlace

function clampWithin(chart: HTMLElement, tooltip: HTMLElement, center: number): number {
  const origin = chart.getBoundingClientRect().left
  const first = chart.firstElementChild ?? chart
  const last = chart.lastElementChild ?? chart
  const min = first.getBoundingClientRect().left - origin
  const max = last.getBoundingClientRect().right - origin
  const width = tooltip.offsetWidth

  return gsap.utils.clamp(min, Math.max(min, max - width), center - origin - width / 2)
}

function columnTooltipPlaceOf(
  column: HTMLElement,
  tooltip: HTMLElement,
  chart: HTMLElement
): TooltipPlace {
  const columnBox = column.getBoundingClientRect()
  const x = clampWithin(chart, tooltip, columnBox.left + columnBox.width / 2)

  return { x, y: 0 }
}

function rowTooltipPlaceOf(
  bar: HTMLElement,
  tooltip: HTMLElement,
  list: HTMLElement
): TooltipPlace {
  const barBox = bar.getBoundingClientRect()
  const top = barBox.top - list.getBoundingClientRect().top
  const x = clampWithin(list, tooltip, barBox.right)
  const y = top - ROW_TOOLTIP_GAP - tooltip.offsetHeight

  return { x, y }
}

// React가 툴팁의 transform, opacity, visibility를 inline style로 쓰면 tween 중간값이 덮이므로 GSAP만 쓴다.
function useTooltipSlide({
  chartRef,
  tooltipRef,
  anchorsRef,
  shownKey,
  open,
  bars,
  placeOf
}: {
  chartRef: React.RefObject<HTMLElement | null>
  tooltipRef: React.RefObject<HTMLElement | null>
  anchorsRef: React.RefObject<ReadonlyMap<string, HTMLElement>>
  shownKey: string | undefined
  open: boolean
  bars: readonly unknown[]
  placeOf: PlaceTooltip
}): void {
  const allowed = useMotionAllowed()

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const chart = chartRef.current
    if (tooltip == null || chart == null) {
      return
    }

    const anchor = shownKey != null ? anchorsRef.current.get(shownKey) : undefined
    if (!open || anchor == null) {
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

    const { x, y } = placeOf(anchor, tooltip, chart)
    if (!allowed.current) {
      gsap.set(tooltip, { x, y, autoAlpha: 1, overwrite: true })

      return
    }

    const shown = Number(gsap.getProperty(tooltip, 'opacity')) > 0
    if (shown) {
      gsap.to(tooltip, {
        x,
        y,
        duration: TOOLTIP_SLIDE.seconds,
        ease: TOOLTIP_SLIDE.ease,
        overwrite: 'auto'
      })
    } else {
      gsap.set(tooltip, { x, y, overwrite: 'auto' })
    }

    gsap.to(tooltip, {
      autoAlpha: 1,
      duration: TOOLTIP_FADE.seconds,
      ease: TOOLTIP_FADE.ease,
      overwrite: 'auto'
    })
  }, [chartRef, tooltipRef, anchorsRef, shownKey, open, bars, placeOf, allowed])

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current

    return () => {
      if (tooltip != null) {
        gsap.killTweensOf(tooltip)
      }
    }
  }, [tooltipRef, bars])
}

export function ColumnBars({
  bars,
  selectedKey
}: {
  bars: readonly ColumnBar[]
  selectedKey?: string
}): React.JSX.Element {
  const [hover, setHover] = useState<ShownTooltip>({ key: null, open: false })
  const chartRef = useRef<HTMLUListElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const columnsRef = useRef(new Map<string, HTMLLIElement>())
  const shownKey = hover.open ? hover.key : (selectedKey ?? hover.key)
  const shownBar = bars.find(({ key }) => key === shownKey)
  useTooltipSlide({
    chartRef,
    tooltipRef,
    anchorsRef: columnsRef,
    shownKey: shownBar?.key,
    open: hover.open || selectedKey !== undefined,
    bars,
    placeOf: columnTooltipPlaceOf
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
    <div {...stylex.props(styles.chart)}>
      <ul ref={chartRef} onMouseLeave={handleLeave} {...stylex.props(styles.columns)}>
        {bars.map((bar, index) => {
          const startsFine = bar.fine && bars[index - 1]?.fine === false

          return (
            <Fragment key={bar.key}>
              {startsFine && <li aria-hidden="true" {...stylex.props(styles.columnDivider)} />}
              <Column
                bar={bar}
                active={bar.key === shownKey && (hover.open || selectedKey !== undefined)}
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
            <span {...stylex.props(styles.tooltipCount)}>
              {shownBar.share != null
                ? `${integer.format(shownBar.count)}  ${shownBar.share}`
                : integer.format(shownBar.count)}
            </span>
          </>
        )}
      </span>
    </div>
  )
}

function Column({
  bar: { key, label, range, count, share, ratio },
  active,
  onHover,
  register
}: {
  bar: ColumnBar
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
      <span {...stylex.props(shapes.srOnly)}>
        {[range, integer.format(count), share].filter((text) => text != null).join(' ')}
      </span>
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
