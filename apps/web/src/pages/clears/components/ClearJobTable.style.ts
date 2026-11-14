import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

const ROW_HEIGHT = 32
const NAME_WIDTH = 184
const COUNTS_WIDTH = 112
const RATE_WIDTH = 64

export const styles = stylex.create({
  chart: { position: 'relative' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    fontSize: 13,
    lineHeight: '18px'
  },
  headRow: { backgroundColor: colors.bgInset },
  head: {
    height: 40,
    paddingBlock: 4,
    paddingInline: 6,
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: 400,
    textAlign: 'right',
    verticalAlign: 'top',
    color: colors.fgSubtle,
    ':first-child': { paddingLeft: space.s16, textAlign: 'left' },
    ':last-child': { paddingRight: space.s16 }
  },
  headName: { width: NAME_WIDTH },
  headPlot: { textAlign: 'left' },
  headCounts: { width: COUNTS_WIDTH },
  headRate: { width: RATE_WIDTH },
  axis: { display: 'block', marginTop: 4 },
  row: {
    height: ROW_HEIGHT,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault,
    backgroundColor: { default: null, ':hover': colors.bgSurface },
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  cell: {
    paddingBlock: 0,
    paddingInline: 6,
    ':first-child': { paddingLeft: space.s16 },
    ':last-child': { paddingRight: space.s16 }
  },
  name: {
    textAlign: 'left',
    fontWeight: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  sub: { fontSize: 11, color: colors.fgSubtle },
  value: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  muted: { color: colors.fgMuted },
  foot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s12,
    paddingBlock: space.s12,
    paddingInline: space.s16,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  }
})
