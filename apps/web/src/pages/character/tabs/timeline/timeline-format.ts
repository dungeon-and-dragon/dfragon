import type { TimelineClear, TimelineEnhancement } from '#core/shared/search/character-timeline'

export const CLEAR_KIND_LABELS = {
  raid: '레이드',
  legion: '레기온'
} as const satisfies Record<TimelineClear['kind'], string>

export const ENHANCEMENT_KIND_LABELS = {
  reinforce: '강화',
  amplify: '증폭',
  refine: '재련'
} as const satisfies Record<TimelineEnhancement['kind'], string>

export function formatEnhancementValue({ before, after }: TimelineEnhancement): string {
  if (before == null) {
    return String(after)
  }

  return `${before} → ${after}`
}

// 획득 코드 이름은 `아이템 획득(던전 드랍)`처럼 경로를 괄호 안에 둔다.
const ACQUISITION_ROUTE_IN_PARENTHESES = /\(([^()]+)\)/

export function acquisitionRoute(name: string): string {
  const route = ACQUISITION_ROUTE_IN_PARENTHESES.exec(name)?.[1]
  if (route === undefined) {
    return name
  }

  return route
}
