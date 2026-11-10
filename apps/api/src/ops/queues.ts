import { Controller, Get, Inject } from '@nestjs/common'

export const OPS_QUEUE_COUNTS = Symbol('OPS_QUEUE_COUNTS')

export type OpsQueueCount = {
  readonly name: string
  readonly waiting: number
  readonly running: number
}

export type ReadQueueCounts = () => readonly OpsQueueCount[]

@Controller('api/queues')
export class OpsQueuesController {
  constructor(@Inject(OPS_QUEUE_COUNTS) private readonly readCounts: ReadQueueCounts) {}

  @Get()
  queues() {
    return { queues: this.readCounts() }
  }
}
