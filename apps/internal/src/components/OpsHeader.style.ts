import { colors, motion, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  bar: {
    alignSelf: 'stretch',
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  inner: {
    boxSizing: 'border-box',
    width: 1200,
    maxWidth: '100%',
    marginInline: 'auto',
    height: 48,
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    paddingInline: space.s16,
    minWidth: 0
  },
  brand: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    color: colors.fgDefault,
    textDecoration: 'none'
  },
  product: { fontSize: 16, lineHeight: '24px', fontWeight: 700 },
  area: { fontSize: 14, lineHeight: '20px', fontWeight: 500, color: colors.fgMuted },
  divider: { flexShrink: 0, width: 1, height: 20, backgroundColor: colors.borderDefault },
  nav: { height: 48, display: 'flex', alignItems: 'stretch', minWidth: 0 },
  navLink: {
    height: 48,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    paddingInline: space.s12,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    color: { default: colors.fgMuted, ':hover': colors.fgDefault },
    backgroundColor: { default: null, ':hover': colors.bgSurface },
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  external: { display: 'inline-flex', color: colors.fgSubtle },
  spacer: { flexGrow: 1 },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted,
    whiteSpace: 'nowrap'
  },
  statusValue: { fontWeight: 600, color: colors.fgDefault, fontVariantNumeric: 'tabular-nums' },
  stale: { color: colors.fgWarning },
  readAt: { fontWeight: 500, color: colors.fgMuted, fontVariantNumeric: 'tabular-nums' }
})
