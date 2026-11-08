import * as stylex from '@stylexjs/stylex'
import { colors, radius } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  partyRow: {
    height: 28,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    backgroundColor: colors.bgBar
  },
  partyCell: {
    paddingBlock: 0,
    paddingInline: 16,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    textAlign: 'left'
  },
  badge: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    height: 18,
    paddingInline: 5,
    borderRadius: radius.control,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap'
  },
  red: { backgroundColor: colors.raidPartyRedWeak, color: colors.raidPartyRed },
  yellow: { backgroundColor: colors.raidPartyYellowWeak, color: colors.raidPartyYellow },
  green: { backgroundColor: colors.raidPartyGreenWeak, color: colors.raidPartyGreen },
  count: { marginInlineStart: 8, color: colors.fgSubtle, fontVariantNumeric: 'tabular-nums' }
})
