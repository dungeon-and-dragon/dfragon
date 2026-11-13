import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

const NAME_COLUMN_WIDTH = 120
const ROW_GAP = 8
const NAME_FONT_SIZE = 12
const SUB_FONT_SIZE = 11

export const boxPlotStyles = stylex.create({
  chart: { position: 'relative' },
  rows: { margin: 0, padding: 0, listStyle: 'none' },
  row: {
    display: 'grid',
    gridTemplateColumns: `${NAME_COLUMN_WIDTH}px minmax(0, 1fr)`,
    alignItems: 'center',
    columnGap: ROW_GAP
  },
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
  svg: { display: 'block', overflow: 'visible' },
  whisker: { fill: 'none', strokeWidth: 1.5 },
  boxFaded: { fillOpacity: 0.5, strokeWidth: 1 },
  median: { stroke: colors.bgCanvas, strokeWidth: 2 }
})
