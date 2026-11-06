import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  skillName: { margin: 0, fontSize: 13, lineHeight: '18px', fontWeight: 600 },
  optionLines: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    margin: 0,
    paddingBlock: space.s8,
    paddingInline: space.s16,
    listStyle: 'none',
    lineHeight: '20px',
    color: colors.fgMuted,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  }
})
