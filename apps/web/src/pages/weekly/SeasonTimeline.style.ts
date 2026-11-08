import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const BAR_HEIGHT = 4
const SEASON_MIN_WIDTH = 84

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
    backgroundColor: colors.borderStrong
  },
  primevalFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: BAR_HEIGHT,
    borderRadius: 1,
    backgroundImage: colors.rarityPrimordialGradient,
    pointerEvents: 'none'
  },
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
