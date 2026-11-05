import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, radius, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  screen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s16,
    boxSizing: 'border-box',
    minHeight: 360,
    paddingBlock: 48,
    paddingInline: space.s16,
    textAlign: 'center'
  },
  address: {
    margin: 0,
    fontFamily: font.num,
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted
  },
  title: { margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 700 },
  home: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 44,
    paddingInline: 20,
    borderRadius: radius.control,
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    color: colors.onSignal,
    backgroundColor: { default: colors.signal, ':hover': colors.signalHover },
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    outlineOffset: 2,
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  }
})
