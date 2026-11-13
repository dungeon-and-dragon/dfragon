import * as stylex from '@stylexjs/stylex'
import { motion } from '@dfragon/ui/tokens.stylex'

const BAR_HEIGHT = 28
const SEGMENT_GAP = 2
const SEGMENT_RADIUS = 3
const MIN_SEGMENT_WIDTH = 2
const LABEL_INSET = 8

export const splitBarStyles = stylex.create({
  chart: { position: 'relative' },
  bar: {
    display: 'flex',
    gap: SEGMENT_GAP,
    height: BAR_HEIGHT,
    margin: 0,
    padding: 0,
    listStyle: 'none'
  },
  segment: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minWidth: MIN_SEGMENT_WIDTH,
    overflow: 'hidden',
    borderRadius: SEGMENT_RADIUS,
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  segmentDimmed: { opacity: 0.45 },
  grow: (value: number) => ({ flexGrow: value, flexShrink: 1, flexBasis: 0 }),
  colors: (background: string, text: string) => ({ backgroundColor: background, color: text }),
  label: {
    paddingLeft: LABEL_INSET,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap'
  }
})
