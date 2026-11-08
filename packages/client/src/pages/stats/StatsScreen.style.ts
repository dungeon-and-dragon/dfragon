import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, shadow, space } from '@dfragon/ui/tokens.stylex'

const NAME_COLUMN_WIDTH = 120
const VALUE_COLUMN_WIDTH = 72
const BAR_HEIGHT = 8
const ROW_TOOLTIP_OFFSET = `calc(100% + ${space.s8})`
const COLUMN_TOOLTIP_SPACE = 44
const COLUMN_CHART_HEIGHT = 160
const COLUMN_GAP = 2
const COLUMN_DIVIDER_WIDTH = 6
const COLUMN_LABEL_HEIGHT = 14

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    alignItems: 'start',
    gap: space.s16
  },
  state: { margin: 0, fontSize: 13, lineHeight: '18px', color: colors.fgDanger },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s8,
    margin: 0,
    padding: space.s16,
    listStyle: 'none'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: `${NAME_COLUMN_WIDTH}px minmax(0, 1fr) ${VALUE_COLUMN_WIDTH}px`,
    alignItems: 'center',
    gap: space.s12,
    fontSize: 13,
    lineHeight: '18px'
  },
  rowName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  track: { height: BAR_HEIGHT, borderRadius: radius.control, backgroundColor: colors.bgInset },
  bar: {
    position: 'relative',
    display: 'block',
    height: BAR_HEIGHT,
    borderRadius: radius.control,
    backgroundColor: colors.fgSubtle
  },
  barWidth: (percent: number) => ({ width: `${percent}%` }),
  value: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  columnChart: { position: 'relative' },
  columns: {
    display: 'flex',
    gap: COLUMN_GAP,
    margin: 0,
    padding: space.s16,
    listStyle: 'none'
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
  columnBar: {
    width: '100%',
    borderRadius: 1,
    backgroundColor: colors.borderStrong,
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  columnBarActive: { backgroundColor: colors.fgMuted },
  columnHeight: (height: string) => ({ height }),
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
    left: '50%',
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
    transform: 'translateX(-50%)'
  },
  rowTooltip: { top: 'auto', bottom: ROW_TOOLTIP_OFFSET, left: '100%' },
  columnTooltip: {
    top: space.s16,
    left: 0,
    visibility: 'hidden',
    opacity: 0,
    pointerEvents: 'none',
    transform: 'none'
  },
  tooltipStart: { left: 0, transform: 'none' },
  tooltipEnd: { left: 'auto', right: 0, transform: 'none' },
  tooltipRange: { fontSize: 11, lineHeight: '14px', color: colors.fgSubtle },
  tooltipCount: {
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
