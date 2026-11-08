import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import type { FameBar } from './stats-bars'
import { styles } from './StatsScreen.style'

const integer = new Intl.NumberFormat('ko-KR')

export type Bar = Readonly<{ key: string; name: string; value: number }>

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
      {bars.map(({ key, name, value }) => (
        <li key={key} {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.rowName)}>{name}</span>
          <span {...stylex.props(styles.track)}>
            <span {...stylex.props(styles.bar, styles.barWidth(percentOf(value, max)))} />
          </span>
          <span {...stylex.props(styles.value)}>{integer.format(value)}</span>
        </li>
      ))}
    </ul>
  )
}

function heightOf(ratio: number): string {
  if (ratio === 0) {
    return '0'
  }

  return `max(1px, ${ratio * 100}%)`
}

type TooltipAlign = 'center' | 'start' | 'end'

function alignWithin(bar: HTMLElement, tooltip: HTMLElement, chart: HTMLElement): TooltipAlign {
  const barBox = bar.getBoundingClientRect()
  const chartBox = chart.getBoundingClientRect()
  const center = barBox.left + barBox.width / 2
  const half = tooltip.offsetWidth / 2
  if (center - half < chartBox.left) {
    return 'start'
  }

  if (center + half > chartBox.right) {
    return 'end'
  }

  return 'center'
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
  const [align, setAlign] = useState<TooltipAlign>('center')
  const columnRef = useRef<HTMLLIElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const chart = columnRef.current?.parentElement
    if (!active || columnRef.current == null || tooltipRef.current == null || chart == null) {
      setAlign('center')

      return
    }

    setAlign(alignWithin(columnRef.current, tooltipRef.current, chart))
  }, [active])

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
