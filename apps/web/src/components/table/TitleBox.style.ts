import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  box: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s16,
    minHeight: 64,
    boxSizing: 'border-box',
    paddingInline: space.s16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBar
  },
  title: { margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 700 },
  side: { display: 'flex', alignItems: 'center', gap: space.s24 },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  statLabel: { fontSize: 11, lineHeight: '14px', fontWeight: 500, color: colors.fgSubtle },
  statValue: {
    fontSize: 20,
    lineHeight: '24px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
