import type { CollectionSummary } from '@dfragon/database'
import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common'
import { z } from 'zod'
import type { OpsCollectionStore } from '../../../application/ops/ports.js'
import { OpsFailure } from '../../../domain/ops/failure.js'

export const OPS_COLLECTION_STORE = Symbol('OPS_COLLECTION_STORE')

const requeueBody = z.object({ failure: z.string().min(1).optional() })

// 집계가 대기열 테이블 전체를 읽으므로 자주 다시 읽는 job 목록 경로와 나눠 둔다.
@Controller('api/collection')
export class OpsCollectionController {
  constructor(@Inject(OPS_COLLECTION_STORE) private readonly store: OpsCollectionStore) {}

  @Get()
  summary(): Promise<CollectionSummary> {
    return this.store.readSummary()
  }

  @Post('requeue')
  @HttpCode(200)
  async requeue(@Body() body: unknown) {
    const request = requeueBody.safeParse(body)
    if (!request.success) {
      throw new OpsFailure('request')
    }

    return { requeued: await this.store.requeue(request.data.failure) }
  }
}
