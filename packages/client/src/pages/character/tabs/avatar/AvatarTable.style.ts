import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  slotColumn: { width: 76 },
  optionColumn: { width: 240 },
  emblemColumn: { width: 260 },
  icons: { display: 'flex', gap: 4, flexShrink: 0 },
  stack: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  clone: { color: colors.fgSubtle, fontSize: 12, lineHeight: '16px' }
})
