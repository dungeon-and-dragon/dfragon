import * as stylex from '@stylexjs/stylex'

// GSAP tween과 CSS transition이 같은 길이와 곡선을 보도록 한곳에 둔다. GSAP은 CSS 변수를 읽지 못해 theme.css의
// --ease-standard와 같은 곡선을 숫자로 적는다.
export const indicatorSlide = stylex.defineConsts({
  duration: '0.38s',
  curve: '0.2, 0, 0, 1'
})
