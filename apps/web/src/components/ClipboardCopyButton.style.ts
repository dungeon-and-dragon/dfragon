import * as stylex from '@stylexjs/stylex'
import { colors, font, radius, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  failure: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    margin: 0,
    fontSize: 12,
    lineHeight: '14px',
    color: colors.fgMuted,
    whiteSpace: 'nowrap'
  },
  failureMark: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 18,
    height: 18,
    borderRadius: radius.control,
    fontFamily: font.num,
    fontSize: 14,
    fontWeight: 700,
    backgroundColor: colors.bgDangerWeak,
    color: colors.fgDanger
  },
  failureText: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }
})
