import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const BAR_HEIGHT = 4
const SEASON_MIN_WIDTH = 84
const INDICATOR_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const FILL_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

export const styles = stylex.create({
  timeline: {
    position: 'relative',
    display: 'flex',
    gap: 2,
    paddingTop: space.s12,
    paddingBottom: 14,
    paddingInline: space.s16
  },
  placeholder: { height: 34 },
  indicator: {
    position: 'absolute',
    top: space.s12,
    height: BAR_HEIGHT,
    borderRadius: 1,
    backgroundColor: colors.signal,
    pointerEvents: 'none',
    zIndex: 1
  },
  sliding: {
    transitionProperty: 'left, width',
    transitionDuration: { default: '0.38s', '@media (prefers-reduced-motion: reduce)': '0s' },
    transitionTimingFunction: INDICATOR_EASE
  },
  place: (left: number, width: number) => ({ left, width }),
  season: {
    position: 'relative',
    minWidth: SEASON_MIN_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    margin: 0,
    paddingTop: 10,
    paddingBottom: 0,
    paddingInline: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    cursor: { default: 'pointer', ':is(:disabled, [aria-disabled="true"])': 'default' }
  },
  length: (days: number) => ({ flexGrow: days, flexShrink: 1, flexBasis: 0 }),
  bar: {
    position: 'absolute',
    insetInline: 0,
    top: 0,
    height: BAR_HEIGHT,
    borderRadius: 1,
    backgroundColor: {
      default: colors.borderStrong,
      [stylex.when.ancestor(':hover')]: colors.borderInput
    }
  },
  barOff: { backgroundColor: colors.bgInset },
  fill: {
    position: 'absolute',
    insetBlock: 0,
    left: 0,
    borderRadius: 1,
    backgroundColor: colors.borderStrong,
    transitionProperty: 'width',
    transitionDuration: { default: '0.8s', '@media (prefers-reduced-motion: reduce)': '0s' },
    transitionTimingFunction: FILL_EASE
  },
  fillLength: (progress: number) => ({ width: `${progress * 100}%` }),
  primevalFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: BAR_HEIGHT,
    borderRadius: 1,
    backgroundImage: colors.rarityPrimordialGradient,
    opacity: 0,
    pointerEvents: 'none',
    transitionProperty: 'width, opacity',
    transitionDuration: {
      default: '0.8s, 0.5s',
      '@media (prefers-reduced-motion: reduce)': '0s'
    },
    transitionTimingFunction: FILL_EASE
  },
  primevalOn: { opacity: 1 },
  name: {
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    color: { default: colors.fgMuted, [stylex.when.ancestor(':hover')]: colors.fgDefault }
  },
  nameOn: { color: colors.fgDefault, fontWeight: 700 },
  barOn: { backgroundColor: colors.borderStrong },
  off: { color: colors.fgDisabled }
})
