import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const ROW_HEIGHT = 44

export const styles = stylex.create({
  root: { fontSize: 13, lineHeight: '18px', wordBreak: 'keep-all', overflowWrap: 'anywhere' },
  table: { width: '100%', borderCollapse: 'collapse' },
  head: {
    height: 32,
    paddingBlock: 0,
    paddingInline: 10,
    backgroundColor: colors.bgInset,
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  row: {
    height: ROW_HEIGHT,
    backgroundColor: { default: null, ':hover': colors.bgSurface },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  cell: { paddingBlock: 6, paddingInline: 10, verticalAlign: 'middle' },
  first: { paddingInlineStart: space.s16 },
  last: { paddingInlineEnd: space.s16 },
  end: { textAlign: 'right' },
  nowrap: { whiteSpace: 'nowrap' },
  slot: { color: colors.fgSubtle, fontSize: 12, whiteSpace: 'nowrap' },
  number: { fontVariantNumeric: 'tabular-nums' },
  muted: { color: colors.fgMuted },
  missing: { color: colors.fgSubtle }
})
