import * as stylex from '@stylexjs/stylex'
import { colors, radius } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  cell: {
    boxSizing: 'border-box',
    paddingBlock: 0,
    paddingInline: 10,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle'
  },
  seat: { paddingInlineStart: 16 },
  snapshot: { paddingInlineEnd: 16 },
  end: { textAlign: 'right' },
  // 상세 정보 오류는 API 문구를 그대로 보이므로 두 칸 폭에서 줄을 넘길 수 있게 한다.
  wrap: { whiteSpace: 'normal', fontSize: 12, lineHeight: '16px' },
  character: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  well: {
    position: 'relative',
    flexShrink: 0,
    width: 36,
    height: 36,
    overflow: 'hidden',
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  wellEmpty: { backgroundColor: colors.bgSurface },
  badge: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 18,
    paddingInline: 5,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: radius.control,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 700,
    whiteSpace: 'nowrap'
  },
  adventure: { color: colors.fgAdventure },
  guild: { color: colors.fgGuild },
  job: { color: colors.fgMuted },
  subtle: { color: colors.fgSubtle },
  missing: { color: colors.fgDisabled },
  number: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  top: { color: colors.tierTop },
  ranker: { color: colors.tierRanker },
  estimate: { color: colors.fgWarning },
  scoreLabel: { marginInlineEnd: 6, fontSize: 11, color: colors.fgSubtle },
  dealer: { color: colors.scoreDealer },
  buffer: { color: colors.scoreBuffer },
  approximate: {
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: colors.fgSubtle
  },
  notice: { overflow: 'hidden', textOverflow: 'ellipsis' },
  inline: { marginInlineStart: 10, fontSize: 12 },
  mark: { marginInlineEnd: 6, fontWeight: 700 },
  failure: { color: colors.cardFailure },
  error: { color: colors.fgDanger }
})
