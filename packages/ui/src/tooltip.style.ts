import * as stylex from '@stylexjs/stylex'
import { colors, motion, shadow, space } from './tokens.stylex'

export const styles = stylex.create({
  positioner: { zIndex: 120 },
  popup: {
    paddingBlock: 6,
    paddingInline: space.s12,
    borderTopWidth: 2,
    borderTopStyle: 'solid',
    borderTopColor: colors.signal,
    backgroundColor: colors.bgInset,
    boxShadow: `inset 0 0 0 1px ${colors.borderStrong}, ${shadow.tooltip}`,
    color: colors.fgDefault,
    fontSize: 12,
    lineHeight: '14px',
    whiteSpace: 'nowrap',
    opacity: { default: 1, ':is([data-starting-style], [data-ending-style])': 0 },
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  }
})
