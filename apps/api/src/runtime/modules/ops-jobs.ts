import { type DynamicModule, Module } from '@nestjs/common'
import { OPS_JOB_STORE, OpsJobsController, type OpsJobStore } from '../../ops/jobs.js'

export interface OpsJobsModuleOptions {
  readonly store: OpsJobStore
}

@Module({})
export class OpsJobsModule {
  static register({ store }: OpsJobsModuleOptions): DynamicModule {
    return {
      module: OpsJobsModule,
      controllers: [OpsJobsController],
      providers: [{ provide: OPS_JOB_STORE, useValue: store }]
    }
  }
}
