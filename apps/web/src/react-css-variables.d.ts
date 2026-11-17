import 'react'

// GSAP이 길이를 키운 뒤 inline 길이를 지우므로, 데이터에서 온 길이는 CSS 변수로 넘기고 Tailwind class가 읽게 한다.
declare module 'react' {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined
  }
}
