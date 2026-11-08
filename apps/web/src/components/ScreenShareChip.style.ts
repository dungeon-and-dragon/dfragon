import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 보드 헤더 끝의 도구 간격(4px)에 더해 마지막 캡처 시각, 스냅샷과 12px씩 띄운다.
  root: { display: 'inline-flex', marginInlineEnd: space.s8 },
  wrapper: { display: 'inline-flex' },
  trigger: {
    display: 'inline-flex',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  }
})
