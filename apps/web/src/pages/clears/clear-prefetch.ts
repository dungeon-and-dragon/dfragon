import type { ClearStats } from '#entities/ranking'
import { clearContentStatsQuery, clearOverviewQuery } from './api/useClearStats'
import { contentWeeks, findGroup, findStage } from './clear-detail'
import { clearContentsOf } from './clear-groups'
import { findOverviewWeek, overviewWeeks } from './clear-overview'

type ClearDetailAddress = Readonly<{
  contentKey: string
  stage: string | undefined
  week: string | undefined
}>

// 화면이 고르는 주와 컨텐츠를 같은 함수로 골라, 서버가 미리 받는 조회가 화면이 쓰는 조회와 같게 한다.
export function clearOverviewQueryOf(stats: ClearStats, week: string | undefined) {
  const weeks = overviewWeeks(clearContentsOf(stats))
  const selected = findOverviewWeek(weeks, week)
  if (selected === undefined) {
    return null
  }

  return clearOverviewQuery(selected.weekStart)
}

export function clearDetailOf(stats: ClearStats, { contentKey, stage, week }: ClearDetailAddress) {
  const group = findGroup(clearContentsOf(stats), contentKey)
  const first = group?.[0]
  if (group === undefined || first === undefined) {
    return null
  }

  const groupName = first.place.group.name
  const chosen = findStage(group, stage)
  const selected =
    chosen !== undefined ? findOverviewWeek(contentWeeks(chosen.content), week) : undefined
  if (chosen === undefined || selected === undefined) {
    return { groupName, query: null }
  }

  const query = clearContentStatsQuery(chosen.content.id, selected.weekStart)

  return { groupName, query }
}
