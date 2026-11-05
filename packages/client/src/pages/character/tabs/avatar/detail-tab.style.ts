import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  tab: { display: 'flex', flexDirection: 'column', gap: space.s24, padding: space.s16 },
  section: { display: 'flex', flexDirection: 'column', gap: space.s8, minWidth: 0 },
  heading: {
    margin: 0,
    fontSize: 13,
    lineHeight: '18px',
    fontWeight: 600,
    color: colors.fgMuted
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    lineHeight: '18px'
  },
  headCell: {
    paddingBlock: 6,
    paddingInline: space.s8,
    textAlign: 'left',
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    color: colors.fgSubtle,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    whiteSpace: 'nowrap'
  },
  cell: {
    paddingBlock: 6,
    paddingInline: space.s8,
    verticalAlign: 'top',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  slot: { color: colors.fgMuted, whiteSpace: 'nowrap' },
  stack: { display: 'flex', flexDirection: 'column', gap: 2 },
  clone: { fontSize: 12, lineHeight: '16px', color: colors.fgSubtle }
})
