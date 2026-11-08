import * as stylex from '@stylexjs/stylex'

// GSAP tween과 CSS transition이 같은 길이와 곡선을 보도록 한곳에 둔다.
export const indicatorSlide = stylex.defineConsts({
  duration: '0.38s',
  curve: '0.2, 0.8, 0.2, 1'
})
