import * as stylex from '@stylexjs/stylex'
import { colors, radius } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  badge: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    height: 18,
    paddingInline: 5,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: radius.control,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap'
  },
  order: { color: colors.signal },
  moved: { borderColor: colors.signal, backgroundColor: colors.signal, color: colors.onSignal },
  absent: { color: colors.fgDanger }
})
