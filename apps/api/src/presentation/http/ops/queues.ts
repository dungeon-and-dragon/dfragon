import { Controller, Get, Inject } from '@nestjs/common'
import type { ReadQueueCounts } from '../../../application/ops/ports.js'

export const OPS_QUEUE_COUNTS = Symbol('OPS_QUEUE_COUNTS')

@Controller('api/queues')
export class OpsQueuesController {
  constructor(@Inject(OPS_QUEUE_COUNTS) private readonly readCounts: ReadQueueCounts) {}

  @Get()
  queues() {
    return { queues: this.readCounts() }
  }
}
