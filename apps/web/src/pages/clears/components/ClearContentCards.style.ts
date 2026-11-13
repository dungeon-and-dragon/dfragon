import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from '@dfragon/ui/tokens.stylex'

const CARD_WIDTH = 196
const CARD_HEIGHT = 294
const CARD_GAP = 12
const CARD_PADDING = 14
const PAGER_SIZE = 36

export const styles = stylex.create({
  cards: { position: 'relative' },
  track: {
    display: 'flex',
    gap: CARD_GAP,
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollbarWidth: 'none',
    '::-webkit-scrollbar': { display: 'none' }
  },
  card: {
    position: 'relative',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    boxSizing: 'border-box',
    padding: CARD_PADDING,
    overflow: 'hidden',
    scrollSnapAlign: 'start',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: colors.borderDefault, ':hover': colors.borderInput },
    borderRadius: radius.control,
    backgroundColor: colors.bgBar,
    color: colors.fgDefault,
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    transitionProperty: 'border-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  image: {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center 20%'
  },
  imageUrl: (url: string) => ({ backgroundImage: `url("${url}")` }),
  shade: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${colors.bgCanvas} 70%, transparent) 0%, color-mix(in srgb, ${colors.bgCanvas} 20%, transparent) 30%, color-mix(in srgb, ${colors.bgCanvas} 92%, transparent) 78%)`
  },
  layer: { position: 'relative' },
  kind: { fontSize: 11, lineHeight: '14px', fontWeight: 500, color: colors.fgMuted },
  name: { marginTop: 'auto', fontSize: 15, lineHeight: '20px', fontWeight: 700 },
  stages: { display: 'flex', gap: 20, marginTop: 10 },
  stage: { display: 'flex', flexDirection: 'column' },
  stageName: { fontSize: 11, lineHeight: '14px', fontWeight: 500, color: colors.fgMuted },
  rate: {
    fontSize: 22,
    lineHeight: '28px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums'
  },
  rateOne: { fontSize: 28, lineHeight: '34px' },
  change: {
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: colors.fgMuted
  },
  up: { color: colors.chart1 },
  down: { color: colors.chart8 },
  cleared: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: '14px',
    fontVariantNumeric: 'tabular-nums',
    color: colors.fgMuted
  },
  pager: {
    position: 'absolute',
    top: '50%',
    zIndex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: PAGER_SIZE,
    height: PAGER_SIZE,
    marginTop: -PAGER_SIZE / 2,
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: PAGER_SIZE / 2,
    backgroundColor: { default: colors.bgSurface, ':hover': colors.bgControl },
    color: colors.fgDefault,
    cursor: 'pointer'
  },
  previous: { left: -PAGER_SIZE / 2 },
  next: { right: -PAGER_SIZE / 2 },
  pagerIcon: { width: 16, height: 16 },
  previousIcon: { transform: 'rotate(90deg)' },
  nextIcon: { transform: 'rotate(-90deg)' }
})
