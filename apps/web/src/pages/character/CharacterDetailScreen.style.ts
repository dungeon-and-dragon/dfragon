import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 요약 박스(146px), 간격(16px), 탭 줄(40px)과 빈 탭 자리(360px)를 담은 탭 박스(402px)를 합친 높이라 오류가 나도
// 박스 크기가 받는 중과 같다.
const DETAIL_MIN_HEIGHT = 564

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    minHeight: DETAIL_MIN_HEIGHT,
    paddingInline: space.s16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    textAlign: 'center'
  },
  message: { margin: 0, fontSize: 14, lineHeight: '20px', color: colors.fgDanger }
})
