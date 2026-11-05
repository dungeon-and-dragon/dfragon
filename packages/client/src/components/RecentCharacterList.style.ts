import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, space } from '@dfragon/ui/tokens.stylex'

const REMOVE_SIZE = 24

export const styles = stylex.create({
  title: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    margin: 0,
    paddingInline: space.s12,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    color: colors.fgSubtle,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  row: { position: 'relative' },
  item: { paddingInlineEnd: `calc(${space.s12} + ${space.s8} + ${REMOVE_SIZE}px)` },
  remove: {
    position: 'absolute',
    insetInlineEnd: space.s12,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    borderRadius: radius.control,
    backgroundColor: { default: 'transparent', ':hover': colors.bgControlHover },
    color: { default: colors.fgMuted, ':hover': colors.fgDefault },
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: -2,
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  removeIcon: {
    width: 12,
    height: 12,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round'
  }
})
