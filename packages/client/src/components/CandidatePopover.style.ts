import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from '@dfragon/ui/tokens.stylex'

const signalWeak = `color-mix(in srgb, ${colors.signal} 14%, transparent)`

export const styles = stylex.create({
  chip: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    height: 18,
    margin: 0,
    paddingInline: 5,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: radius.control,
    fontFamily: 'inherit',
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    color: colors.signal,
    backgroundColor: {
      default: 'transparent',
      ':hover': signalWeak,
      ':is([data-popup-open])': signalWeak
    },
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2,
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  chevron: { width: 10, height: 10, strokeWidth: 3 },
  positioner: { zIndex: 110, outlineStyle: 'none' },
  popup: {
    boxSizing: 'border-box',
    padding: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: 0,
    backgroundColor: colors.bgSurface,
    boxShadow: '0 8px 24px rgb(0 0 0 / 45%)',
    outlineStyle: 'none'
  },
  tiles: { display: 'flex', gap: 6 },
  tile: {
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    width: 64,
    margin: 0,
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: 'transparent', ':hover': colors.borderStrong },
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    textAlign: 'left',
    color: colors.fgDefault,
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2,
    transitionProperty: 'border-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  shown: {
    borderColor: { default: colors.signal, ':hover': colors.signal },
    boxShadow: `0 0 0 1px ${colors.signal}`
  },
  well: {
    position: 'relative',
    display: 'block',
    width: 62,
    height: 62,
    overflow: 'hidden',
    backgroundColor: colors.bgInset
  },
  check: {
    position: 'absolute',
    top: 2,
    right: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: radius.control,
    backgroundColor: colors.signal,
    color: colors.onSignal
  },
  checkIcon: { width: 10, height: 10, strokeWidth: 4 },
  server: {
    paddingTop: 3,
    paddingInline: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 11,
    lineHeight: '14px',
    color: colors.fgMuted
  },
  fame: {
    paddingInline: 4,
    paddingBottom: 4,
    fontSize: 12,
    lineHeight: '14px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
