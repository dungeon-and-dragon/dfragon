import { type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import { TIMELINE_CODES } from '@dfragon/server-core/domain/character-timeline/index.js'
import { formatSeoulTime, parseSeoulTime } from '@dfragon/server-core/domain/seoul-time.js'
import type { FetchLatestActivity } from '#application/character-activity/ports.js'

const REQUEST_DATE_FORMAT = "yyyyMMdd'T'HHmm"
const ROW_DATE_FORMAT = 'yyyy-MM-dd HH:mm'
const CODE_QUERY = TIMELINE_CODES.join(',')

// 타임라인은 최신 기록부터 오므로 한 행만 받아 마지막 활동 시각으로 쓴다.
export function createNeopleLatestActivity(
  neople: Pick<NeopleClient, 'characterTimeline'>
): FetchLatestActivity {
  return async (character, range) => {
    try {
      const startDate = formatSeoulTime(range.start, REQUEST_DATE_FORMAT)
      const endDate = formatSeoulTime(range.end, REQUEST_DATE_FORMAT)
      const { timeline } = await neople.characterTimeline(character, {
        limit: 1,
        code: CODE_QUERY,
        startDate,
        endDate
      })
      const [row] = timeline.rows

      if (row === undefined) {
        return { status: 'idle' }
      }

      const lastActiveAt = parseSeoulTime(row.date, ROW_DATE_FORMAT)

      if (lastActiveAt === null) {
        return { status: 'failed' }
      }

      return { status: 'active', lastActiveAt }
    } catch (error) {
      if (!(error instanceof NeopleRequestFailure)) {
        throw error
      }

      if (error.kind === 'unavailable' || error.kind === 'timeout') {
        return { status: 'unavailable' }
      }

      return { status: 'failed' }
    }
  }
}
