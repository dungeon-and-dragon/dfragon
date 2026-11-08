import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
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
  const { anchorRef, tooltipRef, align } = useTooltipAlign<HTMLSpanElement>(active, 'end')

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

type TooltipAnchor = 'center' | 'end'

function anchorXOf(box: DOMRect, anchor: TooltipAnchor): number {
  if (anchor === 'end') {
    return box.right
  }

  return box.left + box.width / 2
}

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
  active: boolean,
  anchor: TooltipAnchor
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

    const anchorX = anchorXOf(anchorRef.current.getBoundingClientRect(), anchor)
    setAlign(alignWithin(anchorX, tooltipRef.current, chart))
  }, [active, anchor])

  return { anchorRef, tooltipRef, align }
}

export function FameColumns({ bars }: { bars: readonly FameBar[] }): React.JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null)

  function handleLeave(): void {
    setHovered(null)
  }

  return (
    <ul {...stylex.props(styles.columns)}>
      {bars.map((bar, index) => {
        const startsFine = bar.fine && bars[index - 1]?.fine === false

        return (
          <Fragment key={bar.key}>
            {startsFine && <li aria-hidden="true" {...stylex.props(styles.columnDivider)} />}
            <FameColumn
              bar={bar}
              active={bar.key === hovered}
              onHover={setHovered}
              onLeave={handleLeave}
            />
          </Fragment>
        )
      })}
    </ul>
  )
}

function FameColumn({
  bar: { key, label, range, count, ratio },
  active,
  onHover,
  onLeave
}: {
  bar: FameBar
  active: boolean
  onHover: (key: string) => void
  onLeave: () => void
}): React.JSX.Element {
  const {
    anchorRef: columnRef,
    tooltipRef,
    align
  } = useTooltipAlign<HTMLLIElement>(active, 'center')

  function handleMouseEnter(): void {
    onHover(key)
  }

  return (
    <li
      ref={columnRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
      {...stylex.props(styles.column)}
    >
      <span {...stylex.props(shapes.srOnly)}>{`${range} ${integer.format(count)}`}</span>
      {active && (
        <span
          ref={tooltipRef}
          aria-hidden="true"
          {...stylex.props(
            styles.tooltip,
            align === 'start' && styles.tooltipStart,
            align === 'end' && styles.tooltipEnd
          )}
        >
          <span {...stylex.props(styles.tooltipRange)}>{range}</span>
          <span {...stylex.props(styles.tooltipCount)}>{integer.format(count)}</span>
        </span>
      )}
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
