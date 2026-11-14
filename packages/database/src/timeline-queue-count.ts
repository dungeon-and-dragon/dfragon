import type { DatabaseClient } from './client.js'

export type TimelineQueueCount = {
  name: string
  waiting: number
  running: number
}

// 운영 화면의 표가 지금까지와 같은 순서로 보이게 이 순서로 읽는다. 모르는 이름은 뒤에 이름순으로 둔다.
const QUEUE_ORDER = ['timeline-sync', 'enhancement-backfill', 'season-backfill']

function queuePosition(name: string): number {
  const position = QUEUE_ORDER.indexOf(name)

  if (position === -1) {
    return QUEUE_ORDER.length
  }

  return position
}

export async function writeTimelineQueueCounts(
  client: DatabaseClient,
  counts: readonly TimelineQueueCount[]
): Promise<void> {
  await client.$transaction(
    counts.map(({ name, waiting, running }) =>
      client.timelineQueueCount.upsert({
        where: { name },
        create: { name, waiting, running },
        update: { waiting, running }
      })
    )
  )
}

export async function readTimelineQueueCounts(
  client: DatabaseClient
): Promise<TimelineQueueCount[]> {
  const rows = await client.timelineQueueCount.findMany({ orderBy: { name: 'asc' } })

  return rows.sort((left, right) => queuePosition(left.name) - queuePosition(right.name))
}
