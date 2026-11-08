import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    flexShrink: 0,
    marginInlineEnd: space.s8,
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px'
  },
  value: { color: colors.fgMuted },
  number: {
    fontFamily: font.num,
    color: colors.fgDefault,
    fontSize: 14,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
