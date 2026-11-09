import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, shadow, space } from '@dfragon/ui/tokens.stylex'

const NAME_COLUMN_WIDTH = 120
const VALUE_COLUMN_WIDTH = 64
const ROW_HEIGHT = 28
const BAR_HEIGHT = 6
const EDGE_WIDTH = 2
const EDGE_OVERHANG = 3
const COLUMN_TOOLTIP_SPACE = 44
const COLUMN_CHART_HEIGHT = 160
const COLUMN_GAP = 2
const COLUMN_DIVIDER_WIDTH = 6
const COLUMN_LABEL_HEIGHT = 14
const CHART_PADDING = 16

export const styles = stylex.create({
  chart: { position: 'relative' },
  rows: { margin: 0, padding: CHART_PADDING, listStyle: 'none' },
  row: {
    display: 'grid',
    gridTemplateColumns: `${NAME_COLUMN_WIDTH}px minmax(0, 1fr) ${VALUE_COLUMN_WIDTH}px`,
    alignItems: 'center',
    columnGap: space.s12,
    height: ROW_HEIGHT,
    fontSize: 13,
    lineHeight: '18px'
  },
  rowName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rail: {
    position: 'relative',
    display: 'block',
    height: BAR_HEIGHT,
    '::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      height: 1,
      marginTop: -0.5,
      backgroundColor: colors.bgInset
    }
  },
  rowMark: {
    position: 'absolute',
    left: 0,
    top: 0,
    display: 'block',
    height: '100%',
    minWidth: EDGE_WIDTH
  },
  rowWidth: (percent: number) => ({ width: `${percent}%` }),
  body: {
    position: 'absolute',
    inset: 0,
    opacity: 0.7,
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  bodyActive: { opacity: 1 },
  bodyDimmed: { opacity: 0.3 },
  edge: {
    position: 'absolute',
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  edgeDimmed: { opacity: 0.45 },
  rowBodyCount: {
    backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${colors.fgDefault} 10%, transparent), color-mix(in srgb, ${colors.fgDefault} 80%, transparent))`
  },
  rowBodyFame: {
    backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${colors.gameFame} 10%, transparent), color-mix(in srgb, ${colors.gameFame} 80%, transparent))`
  },
  rowEdge: { right: 0, top: -EDGE_OVERHANG, bottom: -EDGE_OVERHANG, width: EDGE_WIDTH },
  edgeCount: { backgroundColor: colors.fgDefault },
  edgeFame: { backgroundColor: colors.gameFame },
  value: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  valueFame: { color: colors.gameFame },
  columns: {
    position: 'relative',
    display: 'flex',
    gap: COLUMN_GAP,
    margin: 0,
    padding: CHART_PADDING,
    listStyle: 'none',
    '::after': {
      content: '""',
      position: 'absolute',
      left: CHART_PADDING,
      right: CHART_PADDING,
      top: CHART_PADDING + COLUMN_TOOLTIP_SPACE + COLUMN_CHART_HEIGHT,
      height: 1,
      backgroundColor: colors.borderStrong
    }
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingTop: COLUMN_TOOLTIP_SPACE
  },
  columnDivider: {
    flexShrink: 0,
    width: COLUMN_DIVIDER_WIDTH,
    height: COLUMN_CHART_HEIGHT,
    marginTop: COLUMN_TOOLTIP_SPACE,
    backgroundImage: `linear-gradient(${colors.borderDefault}, ${colors.borderDefault})`,
    backgroundSize: '1px 100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  },
  columnTrack: {
    display: 'flex',
    alignItems: 'flex-end',
    height: COLUMN_CHART_HEIGHT
  },
  columnMark: { position: 'relative', display: 'block', width: '100%', minHeight: EDGE_WIDTH },
  columnHeight: (percent: number) => ({ height: `${percent}%` }),
  columnBody: {
    backgroundImage: `linear-gradient(0deg, color-mix(in srgb, ${colors.fgDefault} 6%, transparent), color-mix(in srgb, ${colors.fgDefault} 55%, transparent))`
  },
  columnEdge: { left: 0, right: 0, top: 0, height: EDGE_WIDTH },
  columnLabel: {
    position: 'relative',
    height: COLUMN_LABEL_HEIGHT,
    marginTop: space.s4
  },
  columnLabelText: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 11,
    lineHeight: `${COLUMN_LABEL_HEIGHT}px`,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    color: colors.fgSubtle
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingBlock: 5,
    paddingInline: space.s8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    backgroundColor: colors.bgSurface,
    boxShadow: shadow.popover,
    whiteSpace: 'nowrap',
    visibility: 'hidden',
    opacity: 0,
    pointerEvents: 'none'
  },
  columnTooltip: { top: CHART_PADDING },
  tooltipRange: { fontSize: 11, lineHeight: '14px', color: colors.fgSubtle },
  tooltipCount: {
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
