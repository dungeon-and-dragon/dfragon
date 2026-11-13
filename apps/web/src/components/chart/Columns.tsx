import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { COLUMN_BAR_GROW, useChartBarGrow } from '../../animations/useChartBarGrow'
import { type TooltipPlace, useChartTooltipSlide } from '../../animations/useChartTooltipSlide'
import { styles } from './chart.style'

const integer = new Intl.NumberFormat('ko-KR')

export type ColumnBar = Readonly<{
  key: string
  label: string | null
  range: string
  count: number
  share?: string
  ratio: number
}>

type ShownTooltip = Readonly<{ key: string | null; open: boolean }>

function columnTooltipPlaceOf(
  column: HTMLElement,
  tooltip: HTMLElement,
  chart: HTMLElement
): TooltipPlace {
  const origin = chart.getBoundingClientRect().left
  const first = chart.firstElementChild ?? chart
  const last = chart.lastElementChild ?? chart
  const min = first.getBoundingClientRect().left - origin
  const max = Math.max(min, last.getBoundingClientRect().right - origin - tooltip.offsetWidth)
  const columnBox = column.getBoundingClientRect()
  const center = columnBox.left + columnBox.width / 2 - origin
  const x = Math.min(max, Math.max(min, center - tooltip.offsetWidth / 2))

  return { x, y: 0 }
}

export function Columns({
  groups,
  selectedKey,
  scrollable = false
}: {
  groups: readonly (readonly ColumnBar[])[]
  selectedKey?: string
  scrollable?: boolean
}): React.JSX.Element {
  const [hover, setHover] = useState<ShownTooltip>({ key: null, open: false })
  const scrollerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLUListElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const columnsRef = useRef(new Map<string, HTMLLIElement>())
  const bars = groups.flat()
  const open = hover.open || selectedKey !== undefined
  const shownKey = hover.open ? hover.key : (selectedKey ?? hover.key)
  const shownBar = bars.find(({ key }) => key === shownKey)
  useChartBarGrow(chartRef, COLUMN_BAR_GROW)
  useChartTooltipSlide({
    chartRef,
    tooltipRef,
    anchorsRef: columnsRef,
    shownKey: shownBar?.key,
    open,
    bars,
    placeOf: columnTooltipPlaceOf
  })

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scrollable && scroller != null) {
      scroller.scrollLeft = scroller.scrollWidth
    }
  }, [scrollable])

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
    <div ref={scrollerRef} {...stylex.props(styles.chart, scrollable && styles.chartScroll)}>
      <ul
        ref={chartRef}
        onMouseLeave={handleLeave}
        {...stylex.props(styles.columns, scrollable && styles.columnsScroll)}
      >
        {groups.map((group, index) => (
          <Fragment key={group[0]?.key ?? index}>
            {index > 0 && <li aria-hidden="true" {...stylex.props(styles.columnDivider)} />}
            {group.map((bar) => (
              <Column
                key={bar.key}
                bar={bar}
                dimmed={open && bar.key !== shownKey}
                scrollable={scrollable}
                onHover={handleHover}
                register={registerColumn}
              />
            ))}
          </Fragment>
        ))}
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
  dimmed,
  scrollable,
  onHover,
  register
}: {
  bar: ColumnBar
  dimmed: boolean
  scrollable: boolean
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
    <li
      ref={columnRef}
      data-chart-item=""
      onMouseEnter={handleMouseEnter}
      {...stylex.props(styles.column, scrollable && styles.columnScroll)}
    >
      <span {...stylex.props(shapes.srOnly)}>
        {[range, integer.format(count), share].filter((text) => text != null).join(' ')}
      </span>
      <span {...stylex.props(styles.columnTrack)}>
        {ratio > 0 && (
          <span
            data-chart-mark=""
            {...stylex.props(styles.columnMark, styles.columnHeight(ratio * 100))}
          >
            <span
              {...stylex.props(
                styles.body,
                styles.columnBody,
                styles.bodyCount,
                dimmed && styles.bodyDimmed
              )}
            />
          </span>
        )}
      </span>
      <span aria-hidden="true" {...stylex.props(styles.columnLabel)}>
        {label != null && <span {...stylex.props(styles.columnLabelText)}>{label}</span>}
      </span>
    </li>
  )
}
