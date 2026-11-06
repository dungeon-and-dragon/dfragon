import { z } from 'zod'

export type WeeklySearch = { season?: number }

const searchSchema = z.object({
  season: z.coerce.number().int().positive().optional().catch(undefined)
})

// 라우터는 상위 route의 search에 이 결과를 덮어 합치므로, 읽지 못한 season도 undefined로 덮어 지운다.
export function parseWeeklySearch(search: Record<string, unknown>): WeeklySearch {
  const { season } = searchSchema.parse(search)

  return { season }
}
