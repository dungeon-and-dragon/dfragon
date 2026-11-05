import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 요약(145px), 탭 줄(40px), 빈 탭 자리(360px)를 합친 높이라 오류가 나도 상자 크기가 받는 중과 같다.
const DETAIL_MIN_HEIGHT = 545

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column' },
  error: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: DETAIL_MIN_HEIGHT,
    paddingInline: space.s16,
    textAlign: 'center'
  },
  message: { margin: 0, fontSize: 14, lineHeight: '20px', color: colors.fgDanger }
})
