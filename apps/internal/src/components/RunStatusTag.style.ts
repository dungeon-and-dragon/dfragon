import { colors, radius } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  tag: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    height: 20,
    paddingInline: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: radius.control,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  requested: { color: colors.fgMuted },
  running: { color: colors.fgDefault },
  succeeded: { color: colors.fgSuccess },
  failed: { color: colors.fgDanger },
  interrupted: { color: colors.fgWarning },
  paused: { color: colors.fgMuted }
})
