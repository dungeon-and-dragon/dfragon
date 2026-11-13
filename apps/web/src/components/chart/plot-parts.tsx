import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { styles } from './chart.style'
import type { ChartX, TooltipRow } from './plot-layout'
import { plotStyles } from './plot.style'

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
    <span ref={tooltipRef} aria-hidden="true" {...stylex.props(styles.tooltip)}>
      {title != null && <span {...stylex.props(styles.tooltipRange)}>{title}</span>}
      <span {...stylex.props(plotStyles.tooltipRows)}>
        {rows.map(({ key, name, color, value }) => (
          <span key={key} {...stylex.props(plotStyles.tooltipRow)}>
            <i {...stylex.props(plotStyles.swatch, plotStyles.background(color))} />
            <span {...stylex.props(plotStyles.tooltipName)}>{name}</span>
            <span {...stylex.props(plotStyles.tooltipValue)}>{value}</span>
          </span>
        ))}
      </span>
    </span>
  )
}

export function HitList({
  x,
  places,
  describe,
  onHover,
  onLeave,
  register
}: {
  x: readonly ChartX[]
  places: readonly Readonly<{ left: number; width: number }>[]
  describe: (index: number) => string
  onHover: (key: string) => void
  onLeave: () => void
  register: (key: string, element: HTMLLIElement) => () => void
}): React.JSX.Element {
  return (
    <ul onMouseLeave={onLeave} {...stylex.props(plotStyles.hits)}>
      {x.map(({ key }, index) => (
        <HitArea
          key={key}
          hitKey={key}
          place={places[index] ?? { left: 0, width: 0 }}
          text={describe(index)}
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
  text,
  onHover,
  register
}: {
  hitKey: string
  place: Readonly<{ left: number; width: number }>
  text: string
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
      {...stylex.props(plotStyles.hit, plotStyles.hitPlace(left, width))}
    >
      <span {...stylex.props(shapes.srOnly)}>{text}</span>
    </li>
  )
}
