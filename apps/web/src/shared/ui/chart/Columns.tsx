import { Fragment, useLayoutEffect, useRef } from 'react'
import { COLUMN_BAR_GROW, useChartBarGrow } from './useChartBarGrow'
import { type TooltipPlace, useChartTooltipSlide } from './useChartTooltipSlide'
import { TOOLTIP_CLASS, TOOLTIP_COUNT_CLASS, TOOLTIP_TITLE_CLASS } from './plot-layout'
import { useChartHover } from './useChartHover'

const AXIS_LABEL_GAP = 4

const integer = new Intl.NumberFormat('ko-KR')

export type ColumnBar = Readonly<{
  key: string
  label: string | null
  range: string
  count: number
  share?: string
  ratio: number
}>

// 넓은 화면에서는 막대가 칸에 들어가므로 스크롤 영역을 두지 않는다. 두면 첫 축 라벨이 영역 밖으로 나간 만큼 잘린다.
const NARROW_SCROLL_CLASS = 'max-sm:overflow-x-auto'
// 축 선은 아래 padding 16px, 라벨 위 간격 4px, 라벨 높이 14px를 더한 34px 위에 긋는다.
const COLUMNS_CLASS =
  "relative m-0 flex grow list-none gap-1 p-4 after:absolute after:inset-x-4 after:bottom-[34px] after:h-px after:bg-line-strong after:content-['']"
// 세로 구분선은 위 툴팁 자리 44px와 아래 라벨 자리 18px를 비운다.
const COLUMN_DIVIDER_CLASS =
  'mt-[44px] mb-[18px] w-[6px] shrink-0 bg-[linear-gradient(var(--color-line),var(--color-line))] bg-size-[1px_100%] bg-center bg-no-repeat'

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
  scrollable = false,
  height
}: {
  groups: readonly (readonly ColumnBar[])[]
  selectedKey?: string
  scrollable?: boolean
  height?: number
}): React.JSX.Element {
  const { hover, show, areaProps } = useChartHover()
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

  // 좁은 폭에서 축 글자가 앞 글자와 겹치면 숨기고, 폭이 바뀔 때마다 다시 잰다.
  useLayoutEffect(() => {
    const chart = chartRef.current
    if (chart == null) {
      return
    }

    function hideOverlappingLabels(): void {
      let lastRight = Number.NEGATIVE_INFINITY
      for (const label of chart?.querySelectorAll<HTMLElement>('[data-axis-label]') ?? []) {
        label.style.visibility = ''
        const box = label.getBoundingClientRect()
        if (box.left < lastRight + AXIS_LABEL_GAP) {
          label.style.visibility = 'hidden'
          continue
        }

        lastRight = box.right
      }
    }

    hideOverlappingLabels()
    const observer = new ResizeObserver(hideOverlappingLabels)
    observer.observe(chart)

    return () => {
      observer.disconnect()
    }
  }, [groups])

  function registerColumn(key: string, element: HTMLLIElement): () => void {
    columnsRef.current.set(key, element)

    return () => {
      columnsRef.current.delete(key)
    }
  }

  return (
    <div
      ref={scrollerRef}
      className={`relative flex grow flex-col ${scrollable ? NARROW_SCROLL_CLASS : ''}`}
    >
      <ul
        ref={chartRef}
        {...areaProps}
        className={`${COLUMNS_CLASS} ${scrollable ? 'min-w-min max-sm:gap-px' : ''}`}
      >
        {groups.map((group, index) => (
          <Fragment key={group[0]?.key ?? index}>
            {index > 0 && <li aria-hidden="true" className={COLUMN_DIVIDER_CLASS} />}
            {group.map((bar) => (
              <Column
                key={bar.key}
                bar={bar}
                dimmed={open && bar.key !== shownKey}
                scrollable={scrollable}
                height={height}
                onHover={show}
                register={registerColumn}
              />
            ))}
          </Fragment>
        ))}
      </ul>
      <span ref={tooltipRef} aria-hidden="true" className={`${TOOLTIP_CLASS} top-4`}>
        {shownBar != null && (
          <>
            <span className={TOOLTIP_TITLE_CLASS}>{shownBar.range}</span>
            <span className={TOOLTIP_COUNT_CLASS}>
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
  bar: { key, label, ratio },
  dimmed,
  scrollable,
  height,
  onHover,
  register
}: {
  bar: ColumnBar
  dimmed: boolean
  scrollable: boolean
  height: number | undefined
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
      className={`flex grow basis-0 flex-col pt-[44px] ${scrollable ? 'min-w-1' : 'min-w-0'}`}
    >
      <span
        className="flex min-h-[160px] grow items-end"
        style={height !== undefined ? { minHeight: height } : undefined}
      >
        {ratio > 0 && (
          <span
            data-chart-mark=""
            className="relative block h-(--bar-height) min-h-[2px] w-full"
            style={{ '--bar-height': `${ratio * 100}%` }}
          >
            <span
              className={`absolute inset-0 rounded-t-[3px] bg-chart-1 transition-opacity ${dimmed ? 'opacity-30' : ''}`}
            />
          </span>
        )}
      </span>
      <span aria-hidden="true" className="relative mt-1 h-[14px] shrink-0">
        {label != null && (
          <span
            data-axis-label=""
            className="absolute left-1/2 -translate-x-1/2 text-2xs whitespace-nowrap text-fg-subtle tabular-nums"
          >
            {label}
          </span>
        )}
      </span>
    </li>
  )
}
