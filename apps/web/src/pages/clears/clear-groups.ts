import { colors } from '@dfragon/ui/tokens.stylex'
import type { ClearContent, ClearContentKind } from '#core/ranking/clear-stats'

export type ClearStage = '하드' | '일반'

export type ClearGroup = Readonly<{ key: string; name: string; shortName: string; color: string }>

// choice는 상세 화면의 단계, 미션 선택지이고 slug를 주소 query에 쓴다.
export type ContentChoice = Readonly<{ slug: string; label: string }>

export type ContentPlace = Readonly<{
  group: ClearGroup
  stage: ClearStage | null
  choice: ContentChoice | null
}>

const HARD: ContentChoice = { slug: 'hard', label: '하드' }
const NORMAL: ContentChoice = { slug: 'normal', label: '일반' }

const MICHAELA: ClearGroup = {
  key: 'michaela',
  name: '무너진 성자 미카엘라',
  shortName: '미카엘라',
  color: colors.chart1
}
const DIREGIE: ClearGroup = {
  key: 'diregie',
  name: '디레지에 레이드',
  shortName: '디레지에',
  color: colors.chart2
}
const INAE: ClearGroup = {
  key: 'inae',
  name: '이내 황혼전',
  shortName: '이내 황혼전',
  color: colors.chart3
}
const NABEL: ClearGroup = {
  key: 'nabel',
  name: '만들어진 신 나벨',
  shortName: '나벨',
  color: colors.chart4
}
const NIGHTMARE: ClearGroup = {
  key: 'nightmare',
  name: '각인된 악몽',
  shortName: '각인된 악몽',
  color: colors.chart7
}

// 같은 레이드의 일반과 하드를 카드 하나로 묶고, 기간이나 전환을 바꿔도 같은 색을 쓰게 컨텐츠마다 묶음을 고정한다(ADR 0055).
const CONTENT_PLACES = new Map<string, ContentPlace>([
  ['michaela-hard', { group: MICHAELA, stage: '하드', choice: HARD }],
  ['michaela-normal', { group: MICHAELA, stage: '일반', choice: NORMAL }],
  ['diregie-hard', { group: DIREGIE, stage: '하드', choice: HARD }],
  ['diregie-normal', { group: DIREGIE, stage: '일반', choice: NORMAL }],
  ['inae-twilight', { group: INAE, stage: null, choice: null }],
  ['nabel-hard', { group: NABEL, stage: '하드', choice: HARD }],
  ['nabel-normal', { group: NABEL, stage: '일반', choice: NORMAL }],
  [
    'engraved-nightmare-1',
    { group: NIGHTMARE, stage: null, choice: { slug: '1', label: '죽음을 딛고 선 자' } }
  ]
])

const STAGE_ORDER: readonly (ClearStage | null)[] = ['하드', '일반', null]

export const KIND_LABELS: Readonly<Record<ClearContentKind, string>> = {
  raid: '레이드',
  challenge: '챌린지'
}

export function placeOf({ id, name }: ClearContent): ContentPlace {
  const known = CONTENT_PLACES.get(id)
  if (known !== undefined) {
    return known
  }

  const group = { key: id, name, shortName: name, color: colors.chartBase }

  return { group, stage: null, choice: null }
}

export type ContentAddress = Readonly<{ group: string; stage: string | undefined }>

export function contentAddressOf(contentId: string): ContentAddress {
  const known = CONTENT_PLACES.get(contentId)
  if (known === undefined) {
    return { group: contentId, stage: undefined }
  }

  const stage = known.choice?.slug

  return { group: known.group.key, stage }
}

export function isKnownContentId(contentId: string): boolean {
  return CONTENT_PLACES.has(contentId)
}

export function contentLabelOf(content: ClearContent): string {
  const { group, stage } = placeOf(content)
  if (stage === null) {
    return group.shortName
  }

  return `${group.shortName} ${stage}`
}

export type GroupedContent = Readonly<{ content: ClearContent; place: ContentPlace }>

export function groupsOf(contents: readonly ClearContent[]): GroupedContent[][] {
  const groups = new Map<string, GroupedContent[]>()
  for (const content of contents) {
    const place = placeOf(content)
    groups.set(place.group.key, [...(groups.get(place.group.key) ?? []), { content, place }])
  }

  const releaseOf = (group: readonly GroupedContent[]) =>
    Math.min(...group.map(({ content }) => Date.parse(content.releasedAt)))

  return [...groups.values()]
    .map((group) =>
      group.toSorted(
        (left, right) =>
          STAGE_ORDER.indexOf(left.place.stage) - STAGE_ORDER.indexOf(right.place.stage)
      )
    )
    .toSorted((left, right) => releaseOf(right) - releaseOf(left))
}

export function orderedContents(contents: readonly ClearContent[]): ClearContent[] {
  return groupsOf(contents).flatMap((group) => group.map(({ content }) => content))
}
