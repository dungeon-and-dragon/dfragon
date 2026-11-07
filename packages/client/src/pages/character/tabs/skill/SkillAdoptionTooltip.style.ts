import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 시안의 Tooltip은 위아래 8px이라 공통 Tooltip 틀(6px)에 2px을 더한다. 최소 폭 200px에서 좌우 여백 24px을 뺀 값이다.
const EXTRA_PADDING_BLOCK = 2
const CONTENT_MIN_WIDTH = 176
const MARK_SIZE = 17
const ENHANCEMENT_MARK_SIZE = 18

export const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    minWidth: CONTENT_MIN_WIDTH,
    paddingBlock: EXTRA_PADDING_BLOCK,
    fontSize: 12,
    lineHeight: '16px'
  },
  name: { fontSize: 13, lineHeight: '18px', fontWeight: 600 },
  rows: {
    display: 'grid',
    gridTemplateColumns: 'auto auto',
    columnGap: 20,
    rowGap: 2,
    alignItems: 'center'
  },
  label: { color: colors.fgMuted },
  value: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  heading: { marginTop: space.s4, color: colors.fgSubtle, fontSize: 11, lineHeight: '14px' },
  branch: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  mark: { width: MARK_SIZE, height: MARK_SIZE, imageRendering: 'pixelated' },
  enhancementMark: {
    width: ENHANCEMENT_MARK_SIZE,
    height: ENHANCEMENT_MARK_SIZE,
    imageRendering: 'pixelated'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: space.s16,
    marginTop: space.s4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault,
    color: colors.fgSubtle,
    fontSize: 11,
    lineHeight: '14px',
    fontVariantNumeric: 'tabular-nums'
  }
})
