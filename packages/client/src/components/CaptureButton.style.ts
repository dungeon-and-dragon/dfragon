import * as stylex from '@stylexjs/stylex'

// 상단 바 헤더의 캡처 주 버튼은 32px 정사각형이다. 공용 Button sm(높이 32, paddingInline 12)의 paddingInline과
// 같은 속성을 다시 주면 어느 class가 이길지 StyleX 산출 순서에 달려 있으므로 maxWidth와 좌우 개별 여백으로 줄인다.
export const styles = stylex.create({
  button: { maxWidth: 32, paddingLeft: 8, paddingRight: 8 }
})
