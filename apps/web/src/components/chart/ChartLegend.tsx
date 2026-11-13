import { colors } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { plotStyles } from './plot.style'

export type LegendMark = 'line' | 'block'

export type LegendItem = Readonly<{ key: string; name: string; color: string; mark: LegendMark }>

const MIN_LEGEND_ITEMS = 2

export function ChartLegend({
  items,
  below = false
}: {
  items: readonly LegendItem[]
  below?: boolean
}): React.JSX.Element | null {
  if (items.length < MIN_LEGEND_ITEMS) {
    return null
  }

  return (
    <ul {...stylex.props(plotStyles.legend, below && plotStyles.legendBelow)}>
      {items.map(({ key, name, color, mark }) => (
        <li key={key} {...stylex.props(plotStyles.legendItem)}>
          <i
            aria-hidden="true"
            {...stylex.props(
              plotStyles.legendMark,
              mark === 'line' && plotStyles.legendLine,
              plotStyles.background(color)
            )}
          />
          {name}
        </li>
      ))}
    </ul>
  )
}

const MEDIAN_MARK = `linear-gradient(90deg, ${colors.fgMuted} 0 40%, ${colors.bgCanvas} 40% 60%, ${colors.fgMuted} 60%)`

export function BoxPlotLegend(): React.JSX.Element {
  return (
    <ul {...stylex.props(plotStyles.legend, plotStyles.legendBelow)}>
      <li {...stylex.props(plotStyles.legendItem)}>
        <i
          aria-hidden="true"
          {...stylex.props(
            plotStyles.legendMark,
            plotStyles.legendWide,
            plotStyles.background(colors.fgMuted)
          )}
        />
        25%~75%
      </li>
      <li {...stylex.props(plotStyles.legendItem)}>
        <i
          aria-hidden="true"
          {...stylex.props(
            plotStyles.legendMark,
            plotStyles.legendWide,
            plotStyles.backgroundImage(MEDIAN_MARK)
          )}
        />
        중앙값
      </li>
      <li {...stylex.props(plotStyles.legendItem)}>
        <i
          aria-hidden="true"
          {...stylex.props(
            plotStyles.legendMark,
            plotStyles.legendLine,
            plotStyles.background(colors.fgMuted)
          )}
        />
        5%~95%
      </li>
      <li {...stylex.props(plotStyles.legendItem)}>
        <i
          aria-hidden="true"
          {...stylex.props(
            plotStyles.legendMark,
            plotStyles.legendDot,
            plotStyles.background(colors.fgMuted)
          )}
        />
        최고
      </li>
    </ul>
  )
}
