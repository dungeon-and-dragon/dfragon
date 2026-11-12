import { type DynamicModule, Module } from '@nestjs/common'
import type { CharacterSearchHttpService } from '../../application/character-search/service.js'
import {
  CHARACTER_SEARCH_SERVICE,
  CharacterSearchController
} from '../../presentation/http/character-search/controller.js'

@Module({})
export class CharacterSearchModule {
  static register(service: CharacterSearchHttpService): DynamicModule {
    return {
      module: CharacterSearchModule,
      controllers: [CharacterSearchController],
      providers: [{ provide: CHARACTER_SEARCH_SERVICE, useValue: service }]
    }
  }
}
