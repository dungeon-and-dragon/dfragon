import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'
import { indicatorSlide } from '../animations/indicator-slide.stylex'

const active = ':is([data-active])'

export const styles = stylex.create({
  root: { display: 'flex', alignSelf: 'stretch', flexShrink: 0 },
  list: { position: 'relative', display: 'flex', alignItems: 'stretch' },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    margin: 0,
    paddingInline: space.s12,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: { default: 'transparent', ':hover': colors.bgStripe },
    color: { default: colors.fgMuted, ':hover': colors.fgDefault, [active]: colors.fgDefault },
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: { default: 500, [active]: 700 },
    lineHeight: '20px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outlineOffset: -2,
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  indicator: {
    position: 'absolute',
    bottom: -1,
    left: 'var(--active-tab-left)',
    width: 'var(--active-tab-width)',
    height: 2,
    backgroundColor: colors.signal,
    transitionProperty: 'left, width',
    transitionDuration: {
      default: indicatorSlide.duration,
      '@media (prefers-reduced-motion: reduce)': '0s'
    },
    transitionTimingFunction: `cubic-bezier(${indicatorSlide.curve})`
  }
})
