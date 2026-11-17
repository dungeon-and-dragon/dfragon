import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const POINT_LIST_WIDTH = 400
const POINT_TIME_WIDTH = 84
const CHANGE_SLOT_WIDTH = 56
const NAME_TIME_WIDTH = 160
const NAME_KIND_WIDTH = 96

const line = {
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: colors.borderDefault
} as const

export const styles = stylex.create({
  charts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: space.s16,
    padding: space.s16,
    ...line
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgCanvas
  },
  strip: {
    display: 'flex',
    alignItems: 'center',
    minHeight: 36,
    boxSizing: 'border-box',
    paddingBlock: space.s8,
    paddingInline: space.s16,
    backgroundColor: colors.bgBar,
    ...line
  },
  stripTitle: { margin: 0, fontSize: 13, lineHeight: '18px', fontWeight: 700 },
  stripTime: {
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums'
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    height: 32,
    boxSizing: 'border-box',
    margin: 0,
    paddingInline: space.s16,
    backgroundColor: colors.bgInset,
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    ...line
  },
  headingCount: { color: colors.fgMuted, fontVariantNumeric: 'tabular-nums' },
  points: {
    display: 'grid',
    gridTemplateColumns: `${POINT_LIST_WIDTH}px minmax(0, 1fr)`,
    ...line
  },
  pointList: {
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    padding: 0,
    listStyle: 'none',
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: colors.borderDefault
  },
  point: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    width: '100%',
    minHeight: 56,
    boxSizing: 'border-box',
    margin: 0,
    paddingBlock: space.s8,
    paddingInline: space.s16,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: { default: 'transparent', ':hover': colors.bgSurface },
    color: colors.fgDefault,
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: '18px',
    textAlign: 'left',
    cursor: 'pointer',
    outlineOffset: -2,
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    ...line
  },
  pointSelected: {
    backgroundColor: colors.bgSurface,
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 2,
      backgroundColor: colors.signal
    }
  },
  pointTime: {
    flexShrink: 0,
    width: POINT_TIME_WIDTH,
    color: colors.fgMuted,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums'
  },
  pointTimeSelected: { color: colors.fgDefault, fontWeight: 700 },
  pointParts: {
    minWidth: 0,
    overflow: 'hidden',
    color: colors.fgMuted,
    fontSize: 12,
    lineHeight: '16px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  pointValues: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    marginInlineStart: 'auto',
    fontSize: 12,
    lineHeight: '16px',
    fontVariantNumeric: 'tabular-nums'
  },
  summary: { minWidth: 0 },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    margin: 0,
    ...line
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    margin: 0,
    paddingTop: 14,
    paddingInline: space.s16,
    paddingBottom: space.s16,
    borderLeftWidth: { default: 1, ':first-child': 0 },
    borderLeftStyle: 'solid',
    borderLeftColor: colors.borderDefault
  },
  tileLabel: { color: colors.fgSubtle, fontSize: 12, lineHeight: '16px' },
  tileValue: {
    margin: 0,
    fontSize: 20,
    lineHeight: '32px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums'
  },
  tileDelta: {
    marginTop: space.s4,
    color: colors.fgSubtle,
    fontSize: 11,
    lineHeight: '16px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums'
  },
  up: { color: colors.gameIncrease },
  down: { color: colors.gameDecrease },
  fame: { color: colors.gameFame },
  dealer: { color: colors.scoreDealer },
  buffer: { color: colors.scoreBuffer },
  changes: { margin: 0, padding: 0, listStyle: 'none' },
  change: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 2,
    paddingBlock: 10,
    paddingInline: space.s16,
    fontSize: 13,
    lineHeight: '18px',
    ...line
  },
  changeSlot: { flexShrink: 0, width: CHANGE_SLOT_WIDTH, color: colors.fgSubtle },
  changeField: { marginInlineStart: 6, color: colors.fgSubtle },
  changeOption: { color: colors.fgMuted },
  before: { color: colors.fgSubtle, fontVariantNumeric: 'tabular-nums' },
  arrow: { marginInline: 2, color: colors.fgSubtle },
  after: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  enhance: { color: colors.gameEnhance },
  amplify: { color: colors.gameAmplify },
  refine: { color: colors.gameRefine },
  enchant: { color: colors.gameEnchant },
  first: { color: colors.fgSubtle },
  unchanged: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.s4,
    margin: 0,
    paddingBlock: space.s12,
    paddingInline: space.s16,
    listStyle: 'none'
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 20,
    paddingInline: 6,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 500,
    whiteSpace: 'nowrap'
  },
  empty: {
    margin: 0,
    paddingBlock: 48,
    paddingInline: space.s16,
    color: colors.fgDefault,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 700,
    textAlign: 'center',
    ...line
  },
  message: { padding: space.s16 },
  error: { margin: 0, color: colors.fgDanger, fontSize: 13, lineHeight: '18px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    height: 32,
    paddingBlock: 0,
    paddingInline: 10,
    backgroundColor: colors.bgInset,
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    ...line
  },
  thTime: { width: NAME_TIME_WIDTH, paddingInlineStart: space.s16 },
  thKind: { width: NAME_KIND_WIDTH },
  row: { height: 44, ...line },
  td: {
    paddingBlock: 6,
    paddingInline: 10,
    verticalAlign: 'middle',
    fontSize: 13,
    lineHeight: '18px'
  },
  tdTime: {
    paddingInlineStart: space.s16,
    color: colors.fgSubtle,
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap'
  },
  tdName: { paddingInlineEnd: space.s16 },
  kind: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 20,
    paddingInline: 6,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 500
  },
  nameBefore: { color: colors.fgSubtle },
  nameArrow: { marginInline: 6, color: colors.fgSubtle },
  nameAfter: { fontWeight: 600 },
  adventureAfter: { color: colors.fgMuted },
  skeletonCharts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: space.s16,
    padding: space.s16,
    ...line
  },
  skeletonBody: {
    display: 'grid',
    gridTemplateColumns: `${POINT_LIST_WIDTH}px minmax(0, 1fr)`,
    gap: space.s16,
    padding: space.s16
  },
  skeletonColumn: { display: 'flex', flexDirection: 'column', gap: space.s8 },
  skeletonTiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: space.s8,
    padding: space.s16,
    ...line
  },
  skeletonRows: { display: 'flex', flexDirection: 'column', gap: space.s8, padding: space.s16 },
  bone: { display: 'block', borderRadius: radius.control, backgroundColor: colors.bgSurface },
  boneHeight: (height: number) => ({ height })
})
