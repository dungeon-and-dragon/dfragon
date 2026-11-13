import type { ClearRecordLegionWeek, StoredClearPopulation } from '@dfragon/database'
import { formatResetDate, startOfResetWeek } from '../seoul-time.js'
import type { ClearContentHeader, ClearContentSummary, ClearWeek } from './stats.js'

export type ClearLegion = {
  id: string
  name: string
  releasedAt: Date
}

// 화면에 쓰는 레기온만 둔다. 출시일은 운영 DB의 첫 클리어 날이고 업데이트는 06:00(KST) 초기화에 열린다(2026-11-10).
// name은 타임라인 레기온 클리어 기록의 regionName과 글자까지 같아야 한다.
export const CLEAR_LEGIONS: readonly ClearLegion[] = [
  {
    id: 'legion-apocalypse',
    name: '아포칼립스',
    releasedAt: new Date('2026-04-23T06:00:00+09:00')
  },
  { id: 'legion-venus', name: '베누스', releasedAt: new Date('2025-02-06T06:00:00+09:00') }
]

function toLegionHeader(legion: ClearLegion, latestId: string | undefined): ClearContentHeader {
  const { id, name } = legion
  const releasedAt = legion.releasedAt.toISOString()
  const latest = id === latestId

  return { id, kind: 'legion', name, releasedAt, entryFame: null, latest }
}

// 레기온은 단계를 가릴 수 없어 그 주에 한 번이라도 깬 캐릭터 수를 세고, 분모는 그 주 수집 대상 수다.
// 수집 대상 수는 분모 기준 명성이 가장 낮아 모집단이 가장 큰 컨텐츠의 그 주 모집단이다.
function toLegionWeeks(
  legion: ClearLegion,
  populations: readonly StoredClearPopulation[],
  counts: readonly ClearRecordLegionWeek[]
): ClearWeek[] {
  const legionCounts = counts.filter(({ name }) => name === legion.name)
  const firstRecorded = legionCounts.reduce<number | undefined>((first, { weekStart }) => {
    const time = weekStart.getTime()

    if (first === undefined || time < first) {
      return time
    }

    return first
  }, undefined)

  if (firstRecorded === undefined) {
    return []
  }

  const startTime = Math.max(firstRecorded, startOfResetWeek(legion.releasedAt).getTime())
  const collections = new Map<number, StoredClearPopulation>()

  for (const population of populations) {
    const time = population.weekStart.getTime()
    const current = collections.get(time)

    if (
      time >= startTime &&
      (current === undefined || population.population > current.population)
    ) {
      collections.set(time, population)
    }
  }

  return [...collections.values()]
    .sort((left, right) => left.weekStart.getTime() - right.weekStart.getTime())
    .map((collection) => {
      const cleared = legionCounts
        .filter(({ weekStart }) => weekStart.getTime() === collection.weekStart.getTime())
        .reduce((total, count) => total + count.cleared, 0)
      const ratios = cleared > 0 ? [{ ratio: null, cleared }] : []
      const resetDate = formatResetDate(collection.weekStart)
      const collectedAt = collection.collectedAt.toISOString()

      return {
        weekStart: resetDate,
        closed: collection.closed,
        collectedAt,
        population: collection.population,
        minFame: collection.minFame,
        cleared,
        newlyCleared: null,
        ratios
      }
    })
}

export function toLegionSummaries(
  populations: readonly StoredClearPopulation[],
  counts: readonly ClearRecordLegionWeek[]
): ClearContentSummary[] {
  const latestId = CLEAR_LEGIONS.toSorted(
    (left, right) => right.releasedAt.getTime() - left.releasedAt.getTime()
  ).at(0)?.id

  return CLEAR_LEGIONS.map((legion) => {
    const header = toLegionHeader(legion, latestId)
    const weeks = toLegionWeeks(legion, populations, counts)

    return { ...header, weeks }
  })
}
