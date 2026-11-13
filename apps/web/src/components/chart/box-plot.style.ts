import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

const ROW_GAP = 8
const HEAD_HEIGHT = 22
const NAME_FONT_SIZE = 12
const SUB_FONT_SIZE = 11

export const boxPlotStyles = stylex.create({
  chart: { position: 'relative' },
  rows: { margin: 0, padding: 0, listStyle: 'none' },
  row: { display: 'grid', alignItems: 'center', columnGap: ROW_GAP },
  columns: (nameWidth: number, valueWidth: number) => ({
    gridTemplateColumns:
      valueWidth > 0
        ? `${nameWidth}px minmax(0, 1fr) ${valueWidth}px`
        : `${nameWidth}px minmax(0, 1fr)`
  }),
  head: {
    height: HEAD_HEIGHT,
    fontSize: SUB_FONT_SIZE,
    lineHeight: '14px',
    color: colors.fgSubtle
  },
  value: { textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: NAME_FONT_SIZE,
    lineHeight: '16px',
    color: colors.fgMuted
  },
  sub: { fontSize: SUB_FONT_SIZE, color: colors.fgSubtle },
  plotColumn: { minWidth: 0 },
  emptyPlot: (height: number) => ({ height }),
  svg: { display: 'block', overflow: 'visible' },
  whisker: { fill: 'none', strokeWidth: 1.5 },
  boxFaded: { fillOpacity: 0.5, strokeWidth: 1 },
  median: { stroke: colors.bgCanvas, strokeWidth: 2 }
})
