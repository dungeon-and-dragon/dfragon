import { type DynamicModule, Module } from '@nestjs/common'
import {
  OPS_COLLECTION_STORE,
  OpsCollectionController,
  type OpsCollectionStore
} from '../../ops/collection.js'

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
