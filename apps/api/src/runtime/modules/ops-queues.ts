import { type DynamicModule, Module } from '@nestjs/common'
import { OPS_QUEUE_COUNTS, OpsQueuesController, type ReadQueueCounts } from '../../ops/queues.js'

export interface OpsQueuesModuleOptions {
  readonly readQueueCounts: ReadQueueCounts
}

@Module({})
export class OpsQueuesModule {
  static register({ readQueueCounts }: OpsQueuesModuleOptions): DynamicModule {
    return {
      module: OpsQueuesModule,
      controllers: [OpsQueuesController],
      providers: [{ provide: OPS_QUEUE_COUNTS, useValue: readQueueCounts }]
    }
  }
}
