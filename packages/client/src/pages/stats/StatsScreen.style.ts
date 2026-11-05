import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const NAME_COLUMN_WIDTH = 120
const VALUE_COLUMN_WIDTH = 72
const BAR_HEIGHT = 8
const COLUMN_CHART_HEIGHT = 160

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    alignItems: 'start',
    gap: space.s16
  },
  state: { margin: 0, fontSize: 13, lineHeight: '18px', color: colors.fgDanger },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s8,
    margin: 0,
    padding: space.s16,
    listStyle: 'none'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: `${NAME_COLUMN_WIDTH}px minmax(0, 1fr) ${VALUE_COLUMN_WIDTH}px`,
    alignItems: 'center',
    gap: space.s12,
    fontSize: 13,
    lineHeight: '18px'
  },
  rowName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  track: { height: BAR_HEIGHT, borderRadius: radius.control, backgroundColor: colors.bgInset },
  bar: { height: BAR_HEIGHT, borderRadius: radius.control, backgroundColor: colors.fgSubtle },
  barWidth: (percent: number) => ({ width: `${percent}%` }),
  value: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  columns: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: space.s4,
    margin: 0,
    padding: space.s16,
    listStyle: 'none'
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: space.s4,
    fontSize: 12,
    lineHeight: '16px',
    fontVariantNumeric: 'tabular-nums'
  },
  columnValue: { whiteSpace: 'nowrap', fontSize: 11 },
  columnTrack: {
    display: 'flex',
    alignItems: 'flex-end',
    width: '100%',
    height: COLUMN_CHART_HEIGHT
  },
  columnBar: { width: '100%', borderRadius: radius.control, backgroundColor: colors.fgSubtle },
  columnHeight: (percent: number) => ({ height: `${percent}%` }),
  columnLabel: { color: colors.fgSubtle }
})
