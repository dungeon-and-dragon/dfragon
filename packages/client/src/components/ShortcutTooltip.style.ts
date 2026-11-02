import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  label: { display: 'block', textAlign: 'center' },
  shortcut: { display: 'block', textAlign: 'center', color: colors.fgMuted }
})

// 툴팁 trigger로 버튼을 감싼 요소를 버튼 상자와 같은 크기로 둔다.
export const triggerStyles = stylex.create({
  wrapper: { display: 'inline-flex' }
})
