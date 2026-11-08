import * as stylex from '@stylexjs/stylex'
import { colors, motion } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  seat: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    backgroundColor: { default: null, ':hover': colors.bgSurface },
    cursor: 'default',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: -2,
    transitionProperty: 'background-color, opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  movable: { cursor: { default: 'grab', ':active': 'grabbing' } },
  dragSource: { opacity: 0.35 },
  dragTarget: { outlineStyle: 'solid' }
})
