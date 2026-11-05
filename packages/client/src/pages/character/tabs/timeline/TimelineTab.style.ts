import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const ACQUISITION_COLUMN_WIDTH = 500

export const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  columns: {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${ACQUISITION_COLUMN_WIDTH}px`,
    alignItems: 'start',
    gap: space.s16
  },
  group: {
    minWidth: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: radius.control
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    height: 32,
    margin: 0,
    paddingInline: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    backgroundColor: colors.bgInset,
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    whiteSpace: 'nowrap'
  },
  groupTitle: { fontWeight: 700 },
  groupCount: { fontVariantNumeric: 'tabular-nums' },
  empty: {
    margin: 0,
    paddingBlock: space.s12,
    paddingInline: space.s16,
    color: colors.fgSubtle,
    fontSize: 13,
    lineHeight: '18px'
  },
  list: { margin: 0, padding: 0, listStyle: 'none' },
  clear: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minHeight: 36,
    paddingInline: space.s16,
    fontSize: 13,
    lineHeight: '18px',
    borderTopWidth: { default: 1, ':first-child': 0 },
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
  clearName: {
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  clearMode: { color: colors.fgMuted, whiteSpace: 'nowrap' },
  clearTime: {
    marginInlineStart: 'auto',
    flexShrink: 0,
    color: colors.fgSubtle,
    fontVariantNumeric: 'tabular-nums'
  },
  counts: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.s8,
    margin: 0,
    padding: space.s12,
    listStyle: 'none'
  },
  countChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingInline: space.s8,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    fontSize: 13,
    lineHeight: '18px',
    whiteSpace: 'nowrap'
  },
  countValue: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
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
  badgeInChip: { backgroundColor: colors.bgInset },
  muted: { color: colors.fgMuted },
  table: {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontSize: 13,
    lineHeight: '18px'
  },
  width: (width: number) => ({ width }),
  header: {
    height: 32,
    paddingBlock: 0,
    paddingInline: 10,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    backgroundColor: colors.bgInset,
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    textAlign: 'left',
    whiteSpace: 'nowrap'
  },
  cell: {
    height: 36,
    paddingBlock: 0,
    paddingInline: 10,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  first: { paddingInlineStart: space.s16 },
  last: { paddingInlineEnd: space.s16 },
  time: { color: colors.fgSubtle, fontVariantNumeric: 'tabular-nums' },
  number: { fontVariantNumeric: 'tabular-nums' },
  result: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  reinforce: { color: colors.gameEnhance },
  amplify: { color: colors.gameAmplify },
  refine: { color: colors.gameRefine },
  success: { color: colors.fgSuccess },
  failure: { color: colors.fgDanger },
  missing: { color: colors.fgDisabled },
  state: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s8,
    minHeight: 360,
    paddingInline: space.s16,
    color: colors.fgMuted,
    fontSize: 14,
    lineHeight: '20px',
    textAlign: 'center'
  },
  error: { color: colors.fgDanger }
})

export const rarityStyles = stylex.create({
  common: { color: colors.rarityCommon },
  uncommon: { color: colors.rarityUncommon },
  rare: { color: colors.rarityRare },
  unique: { color: colors.rarityUnique },
  epic: { color: colors.rarityEpic },
  legendary: { color: colors.rarityLegendary },
  chronicle: { color: colors.rarityChronicle },
  primordial: { color: colors.rarityPrimordial },
  mythic: { color: colors.rarityMythic }
})
