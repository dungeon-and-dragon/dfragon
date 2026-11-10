import { type DynamicModule, Module } from '@nestjs/common'
import type { OpsCollectionStore } from '../../application/ops/ports.js'
import {
  OPS_COLLECTION_STORE,
  OpsCollectionController
} from '../../presentation/http/ops/collection.js'

export interface OpsCollectionModuleOptions {
  readonly store: OpsCollectionStore
}

@Module({})
export class OpsCollectionModule {
  static register({ store }: OpsCollectionModuleOptions): DynamicModule {
    return {
      module: OpsCollectionModule,
      controllers: [OpsCollectionController],
      providers: [{ provide: OPS_COLLECTION_STORE, useValue: store }]
    }
  }
}
