import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'

export type WorkerEventInput = {
  occurredAt: Date
  code: string
  details: Readonly<Record<string, unknown>>
}

export async function recordWorkerEvents(
  client: DatabaseClient,
  events: readonly WorkerEventInput[]
): Promise<void> {
  if (events.length === 0) {
    return
  }

  const data = events.map(({ occurredAt, code, details }) => ({
    occurredAt,
    code,
    details: details as Prisma.InputJsonObject
  }))

  await client.workerEvent.createMany({ data })
}

export async function deleteWorkerEventsBefore(
  client: DatabaseClient,
  cutoff: Date
): Promise<number> {
  const { count } = await client.workerEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } })

  return count
}
