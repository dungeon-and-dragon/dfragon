import { type ChartX, TOOLTIP_CLASS, TOOLTIP_TITLE_CLASS, type TooltipRow } from './plot-layout'
import type { ChartHoverAreaProps } from './useChartHover'

export function ChartTooltip({
  tooltipRef,
  title,
  rows
}: {
  tooltipRef: React.RefObject<HTMLSpanElement | null>
  title: string | undefined
  rows: readonly TooltipRow[]
}): React.JSX.Element {
  return (
    <span ref={tooltipRef} aria-hidden="true" className={`${TOOLTIP_CLASS} top-0`}>
      {title != null && <span className={TOOLTIP_TITLE_CLASS}>{title}</span>}
      <span className="mt-1 flex flex-col gap-1">
        {rows.map(({ key, name, color, faded, value }) => (
          <span key={key} className="flex items-center gap-2 text-xs tabular-nums">
            <i
              className={`h-2 w-2 shrink-0 rounded-[2px] ${faded ? 'opacity-50' : ''}`}
              style={{ backgroundColor: color }}
            />
            <span className="text-fg-muted">{name}</span>
            <span className="ml-auto pl-3 num font-semibold">{value}</span>
          </span>
        ))}
      </span>
    </span>
  )
}

export function HitList({
  x,
  places,
  onHover,
  areaProps,
  register
}: {
  x: readonly ChartX[]
  places: readonly Readonly<{ left: number; width: number }>[]
  onHover: (key: string) => void
  areaProps: ChartHoverAreaProps
  register: (key: string, element: HTMLLIElement) => () => void
}): React.JSX.Element {
  return (
    <ul {...areaProps} className="absolute inset-0 m-0 list-none p-0">
      {x.map(({ key }, index) => (
        <HitArea
          key={key}
          hitKey={key}
          place={places[index] ?? { left: 0, width: 0 }}
          onHover={onHover}
          register={register}
        />
      ))}
    </ul>
  )
}

function HitArea({
  hitKey,
  place: { left, width },
  onHover,
  register
}: {
  hitKey: string
  place: Readonly<{ left: number; width: number }>
  onHover: (key: string) => void
  register: (key: string, element: HTMLLIElement) => () => void
}): React.JSX.Element {
  function handleMouseEnter(): void {
    onHover(hitKey)
  }

  function hitRef(element: HTMLLIElement): () => void {
    return register(hitKey, element)
  }

  return (
    <li
      ref={hitRef}
      onMouseEnter={handleMouseEnter}
      className="absolute top-0 bottom-0"
      style={{ left, width }}
    />
  )
}
