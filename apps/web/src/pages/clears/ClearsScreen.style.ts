import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

const HERO_MIN_HEIGHT = 220
const KIND_COLUMN_WIDTH = 80
const JOB_HEAD_HEIGHT = 28
const JOB_ROW_HEIGHT = 32
const JOB_COLUMN_GAP = 12
const JOB_VALUE_WIDTH = 72
const JOB_RATE_WIDTH = 152
const JOB_RATE_VALUE_WIDTH = 48
const JOB_NAME_MIN_WIDTH = 120
const JOB_EDGE_PADDING = 16
const JOB_TABLE_MIN_WIDTH =
  JOB_NAME_MIN_WIDTH +
  JOB_VALUE_WIDTH * 2 +
  JOB_RATE_WIDTH +
  JOB_COLUMN_GAP * 3 +
  JOB_EDGE_PADDING * 2

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  state: { margin: 0, fontSize: 13, lineHeight: '18px', color: colors.fgDanger },
  fame: { color: colors.gameFame },
  box: {
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault
  },
  contents: { backgroundColor: colors.bgBar },
  contentRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    margin: 0,
    paddingBlock: 10,
    paddingInline: space.s16,
    listStyle: 'none',
    borderBottomWidth: { default: 1, ':last-child': 0 },
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  contentKind: {
    flexShrink: 0,
    width: KIND_COLUMN_WIDTH,
    margin: 0,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    color: colors.fgSubtle
  },
  chips: { display: 'contents' },
  hero: {
    position: 'relative',
    minHeight: HERO_MIN_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: space.s24,
    paddingTop: 20,
    paddingBottom: space.s16,
    paddingInline: space.s16,
    overflow: 'hidden',
    backgroundColor: colors.bgBar
  },
  heroHead: { position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 },
  heroKind: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.fgMuted },
  heroName: { margin: 0, fontSize: 24, lineHeight: '30px', fontWeight: 700 },
  heroRelease: {
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted,
    fontVariantNumeric: 'tabular-nums'
  },
  heroBottom: {
    position: 'relative',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s16
  },
  figures: { display: 'flex', gap: 40, margin: 0 },
  figure: { display: 'flex', flexDirection: 'column', gap: 2 },
  figureLabel: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.fgSubtle },
  figureValue: {
    margin: 0,
    fontSize: 20,
    lineHeight: '26px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  },
  figureMain: { fontSize: 28, lineHeight: '34px', fontWeight: 700 },
  empty: {
    margin: 0,
    paddingBlock: 48,
    paddingInline: space.s16,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 700,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
  weekChart: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
  pair: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    alignItems: 'start',
    gap: space.s16
  },
  boxHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s12
  },
  boxTitle: { margin: 0, fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 'inherit' },
  sortChips: { display: 'flex', gap: 6 },
  // 이름 칸만 남은 폭을 받으므로, 좁은 창에서 이름이 사라지지 않게 표가 줄어들 수 있는 폭을 막는다.
  jobTable: {
    width: '100%',
    minWidth: JOB_TABLE_MIN_WIDTH,
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    fontSize: 13,
    lineHeight: '18px'
  },
  jobHeadRow: { height: JOB_HEAD_HEIGHT, backgroundColor: colors.bgInset },
  jobHead: {
    paddingBlock: 0,
    paddingInline: `${JOB_COLUMN_GAP / 2}px`,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 400,
    textAlign: 'right',
    color: colors.fgSubtle,
    ':first-child': { paddingLeft: JOB_EDGE_PADDING },
    ':last-child': { paddingRight: JOB_EDGE_PADDING }
  },
  jobHeadName: { textAlign: 'left' },
  jobHeadValue: { width: JOB_VALUE_WIDTH },
  jobHeadRate: { width: JOB_RATE_WIDTH },
  jobRow: {
    height: JOB_ROW_HEIGHT,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault,
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  jobRowActive: { backgroundColor: colors.bgSurface },
  jobCell: {
    paddingBlock: 0,
    paddingInline: `${JOB_COLUMN_GAP / 2}px`,
    ':first-child': { paddingLeft: JOB_EDGE_PADDING },
    ':last-child': { paddingRight: JOB_EDGE_PADDING }
  },
  jobName: {
    textAlign: 'left',
    fontWeight: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  jobValue: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  jobPopulation: { color: colors.fgMuted },
  jobRate: {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${JOB_RATE_VALUE_WIDTH}px`,
    alignItems: 'center',
    columnGap: 10
  },
  more: {
    display: 'flex',
    justifyContent: 'center',
    paddingBlock: space.s12,
    paddingInline: space.s16,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  }
})
