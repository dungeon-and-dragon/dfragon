import type { CollectionSummary } from '@dfragon/database'
import { z } from 'zod'

export const requeueBody = z.object({ failure: z.string().min(1).optional() })

export type RequeueBody = z.infer<typeof requeueBody>

export type CollectionSummaryResponse = CollectionSummary

export type RequeueResponse = {
  requeued: number
}

export function toRequeueResponse(requeued: number): RequeueResponse {
  return { requeued }
}
