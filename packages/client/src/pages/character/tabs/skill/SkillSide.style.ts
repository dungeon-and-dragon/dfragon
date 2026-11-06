import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const SKILL_ICON_SIZE = 28
const MARK_SIZE = 17
const TOOLTIP_WIDTH = 340

export const styles = stylex.create({
  side: {
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    paddingBlock: 10,
    paddingInline: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  code: {
    flexGrow: 1,
    minWidth: 0,
    height: 28,
    boxSizing: 'border-box',
    paddingInline: space.s8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: radius.control,
    backgroundColor: colors.bgSurface,
    color: colors.fgMuted,
    fontSize: 12,
    lineHeight: '26px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  copyLabel: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  chain: {
    display: 'flex',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    rowGap: space.s8,
    margin: 0,
    paddingBlock: 14,
    paddingInline: space.s16,
    listStyle: 'none',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  chainLink: { display: 'flex', alignItems: 'flex-start', gap: 2 },
  chainSkill: {
    width: 64,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    lineHeight: '14px',
    color: colors.fgMuted,
    textAlign: 'center'
  },
  chainArrow: { flexShrink: 0, marginTop: 8, color: colors.fgSubtle },
  rows: { margin: 0, padding: 0, listStyle: 'none' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    minHeight: 56,
    boxSizing: 'border-box',
    paddingBlock: space.s8,
    paddingInline: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  rowBody: { flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  rowTitle: { display: 'flex', alignItems: 'baseline', gap: 6, fontWeight: 500 },
  rowLevel: { color: colors.fgSubtle, fontSize: 11, fontVariantNumeric: 'tabular-nums' },
  branches: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  branch: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    boxSizing: 'border-box',
    margin: 0,
    paddingInline: space.s8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    backgroundColor: { default: colors.bgSurface, ':hover': colors.bgControl },
    color: colors.fgSubtle,
    font: 'inherit',
    fontSize: 12,
    lineHeight: '16px',
    cursor: 'default'
  },
  branchPicked: {
    borderStyle: 'solid',
    borderColor: colors.signal,
    boxShadow: `0 0 0 1px ${colors.signal}`,
    backgroundColor: colors.bgInset,
    color: colors.fgDefault,
    fontWeight: 600
  },
  branchMark: { width: MARK_SIZE, height: MARK_SIZE, imageRendering: 'pixelated' },
  branchMarkDim: { opacity: 0.45 },
  skillIcon: {
    position: 'relative',
    flexShrink: 0,
    width: SKILL_ICON_SIZE,
    height: SKILL_ICON_SIZE
  },
  skillIconPicked: { boxShadow: `0 0 0 2px ${colors.signal}` },
  emptyIcon: {
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  tooltip: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s8,
    width: TOOLTIP_WIDTH,
    paddingBlock: 4,
    fontSize: 12,
    lineHeight: '18px',
    whiteSpace: 'normal',
    wordBreak: 'keep-all'
  },
  tooltipTitle: { fontWeight: 600 },
  tooltipSummary: { color: colors.fgMuted },
  fallback: { display: 'flex', flexDirection: 'column', gap: space.s24, padding: space.s16 }
})
