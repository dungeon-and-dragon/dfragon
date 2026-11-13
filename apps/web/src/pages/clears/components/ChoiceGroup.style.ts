import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  group: {
    display: 'inline-flex',
    flexShrink: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    overflow: 'hidden'
  },
  option: {
    height: 22,
    paddingBlock: 0,
    paddingInline: 8,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 12,
    lineHeight: '16px',
    color: { default: colors.fgMuted, ':hover': colors.fgDefault },
    cursor: 'pointer',
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  large: { height: 30, paddingInline: 16, fontSize: 13, lineHeight: '18px' },
  pressed: {
    backgroundColor: colors.signal,
    color: { default: colors.onSignal, ':hover': colors.onSignal },
    fontWeight: 700,
    cursor: 'default'
  }
})
