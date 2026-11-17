// jsdom은 색을 계산하지 않으므로 숫자가 어느 색 utility를 가졌는지로 점수나 명성 색을 확인한다.
const TONE_UTILITIES = {
  dealer: 'text-score-dealer',
  buffer: 'text-score-buffer',
  fame: 'text-game-fame',
  top: 'text-tier-top',
  ranker: 'text-tier-ranker'
} as const

type Tone = keyof typeof TONE_UTILITIES

export function toneClassesOf(element: Element): Tone[] {
  const classes = element.className.split(' ')

  return (['dealer', 'buffer', 'fame', 'top', 'ranker'] as const).filter((tone) =>
    classes.includes(TONE_UTILITIES[tone])
  )
}
