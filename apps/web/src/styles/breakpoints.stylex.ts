import * as stylex from '@stylexjs/stylex'

// 1080px 화면 상자 바깥 오른쪽에 히트맵 세로 탭(상자에서 16px 띄운 120px)을 두면 탭이 화면 상자 밖으로 119px 나간다.
// 양쪽에 그 119px와 여백 16px, Windows의 세로 스크롤 막대 17px를 더한 1080 + 2 × 135 + 17 = 1367px부터 둘 자리가 있다.
export const breakpoints = stylex.defineConsts({
  screenSideRoom: '@media (min-width: 1367px)'
})
