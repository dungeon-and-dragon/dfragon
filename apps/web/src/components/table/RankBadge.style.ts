import * as stylex from '@stylexjs/stylex'
import { colors, radius } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    height: 20,
    paddingInline: 6,
    boxSizing: 'border-box',
    borderRadius: radius.control,
    backgroundColor: colors.signal,
    color: colors.onSignal,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums'
  },
  plain: {
    fontSize: 13,
    lineHeight: '18px',
    color: colors.fgMuted,
    fontVariantNumeric: 'tabular-nums'
  }
})
