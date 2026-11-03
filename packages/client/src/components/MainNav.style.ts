import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

const popupOpen = ':is([data-popup-open])'

export const styles = stylex.create({
  nav: { display: 'flex', alignSelf: 'stretch', gap: space.s4, flexShrink: 0 },
  item: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    margin: 0,
    paddingInline: space.s12,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.bgStripe,
      [popupOpen]: colors.bgStripe
    },
    color: colors.fgDefault,
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outlineOffset: -2,
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    ':focus-visible': { outline: `2px solid ${colors.signal}` }
  },
  underline: {
    position: 'absolute',
    insetInline: 0,
    bottom: -1,
    height: 2,
    backgroundColor: colors.signal
  },
  sub: { fontWeight: 500, color: colors.fgMuted },
  chevron: {
    flexShrink: 0,
    color: colors.fgMuted,
    transform: { default: 'none', [stylex.when.ancestor(popupOpen)]: 'scaleY(-1)' },
    transitionProperty: 'transform',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  }
})
