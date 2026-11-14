import { Hono } from 'hono'
import { z } from 'zod'
import type { OpsCollectionStore } from '../../../application/collection/ports.js'
import { OpsFailure } from '../../../domain/failure.js'
import { readJsonBody } from '../json-request.js'

const requeueBody = z.object({ failure: z.string().min(1).optional() })

// 집계가 대기열 테이블 전체를 읽으므로 자주 다시 읽는 job 목록 경로와 나눠 둔다.
export function createOpsCollectionRoutes(store: OpsCollectionStore): Hono {
  const routes = new Hono()

  routes.get('/', async (c) => c.json(await store.readSummary()))

  routes.post('/requeue', async (c) => {
    const request = requeueBody.safeParse(await readJsonBody(c))
    if (!request.success) {
      throw new OpsFailure('request')
    }

    return c.json({ requeued: await store.requeue(request.data.failure) })
  })

  return routes
}
