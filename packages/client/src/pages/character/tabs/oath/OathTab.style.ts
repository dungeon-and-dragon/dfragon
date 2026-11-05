import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const SIDE_WIDTH = 480

export const styles = stylex.create({
  body: { display: 'flex', alignItems: 'flex-start' },
  crystals: {
    flexGrow: 1,
    minWidth: 0,
    borderInlineEndWidth: 1,
    borderInlineEndStyle: 'solid',
    borderInlineEndColor: colors.borderDefault
  },
  side: { flexShrink: 0, width: SIDE_WIDTH },
  heading: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    height: 32,
    margin: 0,
    paddingInline: space.s16,
    backgroundColor: colors.bgInset,
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  count: { color: colors.fgMuted, fontWeight: 500, fontVariantNumeric: 'tabular-nums' },
  slotColumn: { width: 56 },
  pointColumn: { width: 110 },
  list: { margin: 0, padding: 0 },
  line: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s12,
    height: 32,
    paddingInline: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  term: { color: colors.fgMuted },
  value: { margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }
})
