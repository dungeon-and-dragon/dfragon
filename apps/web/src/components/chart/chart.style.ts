import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, shadow, space } from '@dfragon/ui/tokens.stylex'
import { breakpoints } from '../../styles/breakpoints.stylex'

const NAME_COLUMN_WIDTH = 120
const WIDE_NAME_COLUMN_WIDTH = 176
const VALUE_COLUMN_WIDTH = 64
const ROW_HEIGHT = 28
const BAR_HEIGHT = 6
const THICK_BAR_HEIGHT = 10
const MIN_MARK_SIZE = 2
const MARK_RADIUS = 3
const COLUMN_TOOLTIP_SPACE = 44
const COLUMN_CHART_HEIGHT = 160
const COLUMN_GAP = 2
const NARROW_COLUMN_GAP = 1
const MIN_COLUMN_WIDTH = 4
const COLUMN_DIVIDER_WIDTH = 6
const COLUMN_LABEL_HEIGHT = 14
const COLUMN_LABEL_GAP = 4
const CHART_PADDING = 16

export const styles = stylex.create({
  chart: { position: 'relative' },
  chartFill: { display: 'flex', flexDirection: 'column', flexGrow: 1 },
  rowsFill: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
    flexGrow: 1
  },
  // 넓은 화면에서는 막대가 칸에 들어가므로 스크롤 영역을 두지 않는다. 두면 첫 축 라벨이 영역 밖으로 나간 만큼 잘린다.
  chartScroll: { overflowX: { default: null, [breakpoints.screenNarrow]: 'auto' } },
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
  rowWideName: {
    gridTemplateColumns: `${WIDE_NAME_COLUMN_WIDTH}px minmax(0, 1fr) ${VALUE_COLUMN_WIDTH}px`
  },
  rowName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowSub: { fontSize: 11, color: colors.fgSubtle },
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
    minWidth: MIN_MARK_SIZE
  },
  rowWidth: (percent: number) => ({ width: `${percent}%` }),
  body: {
    position: 'absolute',
    inset: 0,
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  bodyDimmed: { opacity: 0.3 },
  bodyCount: { backgroundColor: colors.chart1 },
  bodyFame: { backgroundColor: colors.gameFame },
  rowBody: { borderRadius: MARK_RADIUS },
  railThick: { height: THICK_BAR_HEIGHT },
  rowBodyThick: { borderRadius: THICK_BAR_HEIGHT / 2 },
  value: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  valueFame: { color: colors.gameFame },
  columnsChart: { display: 'flex', flexDirection: 'column', flexGrow: 1 },
  columns: {
    position: 'relative',
    display: 'flex',
    flexGrow: 1,
    gap: COLUMN_GAP,
    margin: 0,
    padding: CHART_PADDING,
    listStyle: 'none',
    '::after': {
      content: '""',
      position: 'absolute',
      left: CHART_PADDING,
      right: CHART_PADDING,
      bottom: CHART_PADDING + COLUMN_LABEL_GAP + COLUMN_LABEL_HEIGHT,
      height: 1,
      backgroundColor: colors.borderStrong
    }
  },
  columnsScroll: {
    minWidth: 'min-content',
    gap: { default: COLUMN_GAP, [breakpoints.screenNarrow]: NARROW_COLUMN_GAP }
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingTop: COLUMN_TOOLTIP_SPACE
  },
  columnScroll: { minWidth: MIN_COLUMN_WIDTH },
  columnDivider: {
    flexShrink: 0,
    width: COLUMN_DIVIDER_WIDTH,
    marginTop: COLUMN_TOOLTIP_SPACE,
    marginBottom: COLUMN_LABEL_GAP + COLUMN_LABEL_HEIGHT,
    backgroundImage: `linear-gradient(${colors.borderDefault}, ${colors.borderDefault})`,
    backgroundSize: '1px 100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  },
  columnTrack: {
    display: 'flex',
    flexGrow: 1,
    alignItems: 'flex-end',
    minHeight: COLUMN_CHART_HEIGHT
  },
  trackHeight: (height: number) => ({ minHeight: height }),
  columnMark: { position: 'relative', display: 'block', width: '100%', minHeight: MIN_MARK_SIZE },
  columnHeight: (percent: number) => ({ height: `${percent}%` }),
  columnBody: { borderTopLeftRadius: MARK_RADIUS, borderTopRightRadius: MARK_RADIUS },
  columnLabel: {
    position: 'relative',
    flexShrink: 0,
    height: COLUMN_LABEL_HEIGHT,
    marginTop: COLUMN_LABEL_GAP
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
