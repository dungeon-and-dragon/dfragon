import { type DynamicModule, Module } from '@nestjs/common'
import type { CharacterDetailService } from '../../application/character-detail/service.js'
import {
  CHARACTER_DETAIL_SERVICE,
  CharacterDetailController
} from '../../presentation/http/character-detail/controller.js'

@Module({})
export class CharacterDetailModule {
  static register(service: CharacterDetailService): DynamicModule {
    return {
      module: CharacterDetailModule,
      controllers: [CharacterDetailController],
      providers: [{ provide: CHARACTER_DETAIL_SERVICE, useValue: service }]
    }
  }
}
