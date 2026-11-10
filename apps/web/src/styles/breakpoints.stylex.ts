import * as stylex from '@stylexjs/stylex'

// 1080px 화면 상자 바깥 오른쪽에 히트맵 세로 탭(상자에서 16px 띄운 120px)을 두면 탭이 화면 상자 밖으로 119px 나간다.
// 양쪽에 그 119px와 여백 16px, Windows의 세로 스크롤 막대 17px를 더한 1080 + 2 × 135 + 17 = 1367px부터 둘 자리가 있다.
export const breakpoints = stylex.defineConsts({
  screenSideRoom: '@media (min-width: 1367px)',
  // 주 82개를 폭 4px, 사이 2px로 그리면 490px이고, 화면과 상자 여백 66px를 더한 556px보다 좁은 창부터 칸이 모자란다.
  // 그 아래의 휴대폰 폭을 좁은 화면으로 보고 600px에서 가른다.
  screenNarrow: '@media (max-width: 599px)'
})
