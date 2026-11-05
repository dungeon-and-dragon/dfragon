import * as stylex from '@stylexjs/stylex'
import { colors, motion, size, space } from '@dfragon/ui/tokens.stylex'

const current = ':is([aria-current="page"])'

export const styles = stylex.create({
  bar: {
    flexShrink: 0,
    color: colors.fgDefault,
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    boxSizing: 'border-box',
    width: 1080,
    maxWidth: '100%',
    minWidth: 0,
    height: size.topbar,
    marginInline: 'auto',
    paddingInline: space.s16
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    flexShrink: 0,
    color: colors.fgDefault,
    textDecoration: 'none',
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    outlineOffset: 2
  },
  brandIcon: { display: 'block', imageRendering: 'pixelated' },
  name: {
    whiteSpace: 'nowrap',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    lineHeight: '24px'
  },
  divider: { flexShrink: 0, width: 1, height: 20, backgroundColor: colors.borderDefault },
  menu: {
    display: 'flex',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    flexGrow: 1,
    minWidth: 0,
    overflowX: 'auto'
  },
  menuItem: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    paddingInline: space.s12,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: { default: 500, [current]: 700 },
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    color: { default: colors.fgMuted, ':hover': colors.fgDefault, [current]: colors.fgDefault },
    backgroundColor: { default: 'transparent', ':hover': colors.bgSurface },
    outlineOffset: -2,
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  underline: {
    position: 'absolute',
    insetInline: space.s12,
    bottom: 0,
    height: 2,
    backgroundColor: colors.signal
  }
})
